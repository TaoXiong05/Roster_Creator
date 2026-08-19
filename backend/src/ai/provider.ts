export interface AssignmentContextShift {
  rosterShiftId: string;
  date: string;
  startTime: string;
  endTime: string;
  headcount: number;
  responsibilityId: string;
}

export interface AssignmentContextStaff {
  staffId: string;
  name: string;
  responsibilityIds: string[];
  minHours: number;
  maxHours: number;
  hoursPeriod: string;
  hoursUnit: string;
  preferredShifts: { weekday: number; shiftTemplateId: string }[];
  unavailableShifts: { weekday: number; shiftTemplateId: string }[];
  unavailableDateRanges: { start: string; end: string }[];
}

export interface AssignmentContext {
  shifts: AssignmentContextShift[];
  staff: AssignmentContextStaff[];
  hoursPerShift: number;
}

export interface AssignmentResultEntry {
  rosterShiftId: string;
  staffIds: string[];
}

export interface AssignmentResult {
  assignments: AssignmentResultEntry[];
}

export interface AIProvider {
  assignShifts(context: AssignmentContext): Promise<AssignmentResult>;
}

function buildPrompt(context: AssignmentContext): string {
  return [
    '你是一个排班助手。请根据以下班次需求和员工信息，把员工分配到班次。',
    '分配优先级：1) 每个班次都有一个 responsibilityId，表示这个班次需要具备该职责的员工；优先把 responsibilityIds 包含这个 responsibilityId 的员工分配进去，如果没有具备该职责的员工可用，才退而求其次分配其他员工，不要让班次完全空缺；',
    '2) 在满足职责匹配的前提下，优先保证每位员工达到 minHours 的最低量，minHours/maxHours 按 hoursPeriod 周期计算（weekly=每周、fortnightly=每两周、monthly=每月），排此次班表的这段日期占的是这个周期里的一部分，据此按比例衡量是否达标；hoursUnit 决定 minHours/maxHours 的单位——shifts 表示按班次次数计算（每次分配算 1 次）；hours 表示按工时小时数计算，此时不要用 startTime/endTime 去算时长，统一按 hoursPerShift（每个班次等于多少小时，本次排班表设定的值）× 分配到的班次数来估算工时；',
    '3) 再满足员工的 preferredShifts 偏好（每一项是 {weekday, shiftTemplateId}，表示该员工在这一周几想上这一个班次；weekday 0=周日...6=周六）。',
    '硬性约束：绝对不能把员工分配到其 unavailableShifts 命中的班次（格式同 preferredShifts，命中表示这一天所在的星期几这个员工完全不能上这个班次），也不能分配到落在其 unavailableDateRanges 任意一段日期范围内的班次。',
    '每个班次分配的人数不能超过 headcount，也不能把同一个员工分配到同一天的多个班次。',
    '如果员工不够，允许某个班次分配不满，不要虚构不存在的员工 id。',
    '只输出 JSON，不要输出任何解释文字，格式为：',
    '{"assignments":[{"rosterShiftId":"...","staffIds":["..."]}]}',
    '',
    `每个班次等于多少小时（hoursPerShift）：${context.hoursPerShift}`,
    `班次列表：${JSON.stringify(context.shifts)}`,
    `员工列表：${JSON.stringify(context.staff)}`,
  ].join('\n');
}

function isValidResult(value: unknown): value is AssignmentResult {
  if (!value || typeof value !== 'object') return false;
  const assignments = (value as { assignments?: unknown }).assignments;
  if (!Array.isArray(assignments)) return false;
  return assignments.every(
    (a) =>
      a &&
      typeof a === 'object' &&
      typeof (a as any).rosterShiftId === 'string' &&
      Array.isArray((a as any).staffIds) &&
      (a as any).staffIds.every((id: unknown) => typeof id === 'string')
  );
}

export class OpenAICompatibleProvider implements AIProvider {
  async assignShifts(context: AssignmentContext): Promise<AssignmentResult> {
    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!baseUrl || !apiKey || !model) {
      throw new Error('AI provider is not configured (AI_BASE_URL/AI_API_KEY/AI_MODEL)');
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: buildPrompt(context) }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI provider returned no content');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('AI provider returned invalid JSON');
    }

    if (!isValidResult(parsed)) {
      throw new Error('AI provider returned an unexpected response shape');
    }

    return parsed;
  }
}

export const aiProvider: AIProvider = new OpenAICompatibleProvider();

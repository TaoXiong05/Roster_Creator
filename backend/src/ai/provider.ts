export interface AssignmentContextShift {
  rosterShiftId: string;
  date: string;
  startTime: string;
  endTime: string;
  headcount: number;
  requiredSkills: string[];
}

export interface AssignmentContextStaff {
  staffId: string;
  name: string;
  skills: string[];
  minHoursPerWeek: number;
  maxHoursPerWeek: number;
  preferredShiftTemplateIds: string[];
  preferredWeekdays: number[];
  unavailableDateRanges: { start: string; end: string }[];
}

export interface AssignmentContext {
  shifts: AssignmentContextShift[];
  staff: AssignmentContextStaff[];
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
    '分配优先级：1) 优先保证每位员工达到 minHoursPerWeek 的最低工时；',
    '2) 再满足员工的 preferredShiftTemplateIds/preferredWeekdays 偏好，并避开 unavailableDateRanges；',
    '3) 再尽量匹配 requiredSkills。',
    '每个班次分配的人数不能超过 headcount，也不能把同一个员工分配到同一天的多个班次。',
    '如果员工不够，允许某个班次分配不满，不要虚构不存在的员工 id。',
    '只输出 JSON，不要输出任何解释文字，格式为：',
    '{"assignments":[{"rosterShiftId":"...","staffIds":["..."]}]}',
    '',
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

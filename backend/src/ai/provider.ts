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
    '基本规则：每个班次都有一个 responsibilityId，表示这个班次需要具备该职责的员工；优先把 responsibilityIds 包含这个 responsibilityId 的员工分配进去，如果没有具备该职责的员工可用，才退而求其次分配其他员工，不要让班次完全空缺。每个班次分配的人数不能超过 headcount；如果员工不够，允许某个班次分配不满，不要虚构不存在的员工 id。',
    '',
    '以下规则按优先级从高到低排列，前面的规则和后面的规则冲突时，优先满足前面的：',
    '',
    '【一定要遵守（硬性约束，只有在人手/班次确实不够时才允许妥协）】',
    '1. 必须让每位员工达到其 minHours 的最低工时/班次量。minHours/maxHours 按 hoursPeriod 周期计算（weekly=每周、fortnightly=每两周、monthly=每月），本次排班表这段日期只占该周期的一部分，据此按比例衡量是否达标；hoursUnit 决定单位——shifts 表示按分配到的班次次数计算（每次分配算 1 次），hours 表示按工时小时数计算，此时不要用 startTime/endTime 去算时长，统一按 hoursPerShift（每个班次等于多少小时，本次排班表设定的值）× 分配到的班次数来估算工时。',
    '2. 输出里的每个 rosterShiftId、staffId 都必须原样照抄自下方班次列表和员工列表，一个字符都不能改，绝不能创造、改写或编造不存在的 id。',
    '3. 绝对不能把员工分配到落在其 unavailableDateRanges 任意一段日期范围内的班次（例如病假、年假等请假日期）。',
    '',
    '【尽量满足（不是硬性要求，但要尽力，优先级低于上面的硬性约束）】',
    '1. 尽量满足员工的工作倾向：优先分配到其 preferredShifts 命中的班次（每一项是 {weekday, shiftTemplateId}，表示该员工在这一周几想上这一个班次；weekday 0=周日...6=周六）；同时尽量避免分配到其 unavailableShifts 命中的班次（格式同 preferredShifts，表示员工不希望上这个班次，但不是绝对禁止，人手紧张时可以分配）。',
    '2. 避免让员工"连上晚班接早班"：如果某员工前一天的班次结束时间较晚（尤其是跨过零点的班次），第二天不要再把他排进开始时间很早的班次——两个班次之间的休息间隔尽量不少于 11 小时（例如前一天的班次 22:00 才下班，第二天最好不要给他排 6:00 就开始的早班）。判断时用班次的实际 startTime/endTime（而不是 hoursPerShift）计算。',
    '',
    '【尽力避免（优先级最低，和上面的规则冲突时可以让步）】',
    '1. 尽量避免让员工工作超时：同一员工同一天的班次时长加起来尽量不超过 9 小时（用该天各班次的实际 startTime/endTime 计算总时长，而不是 hoursPerShift），也尽量不要把同一个员工排进同一天的两个班次。',
    '',
    '只输出 JSON，不要输出任何解释文字，格式为：',
    '{"assignments":[{"rosterShiftId":"...","staffIds":["..."]}]}',
    '',
    `每个班次等于多少小时（hoursPerShift，仅用于 minHours/maxHours 的工时估算）：${context.hoursPerShift}`,
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

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;

export class OpenAICompatibleProvider implements AIProvider {
  async assignShifts(context: AssignmentContext): Promise<AssignmentResult> {
    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!baseUrl || !apiKey || !model) {
      throw new Error('AI provider is not configured (AI_BASE_URL/AI_API_KEY/AI_MODEL)');
    }

    let lastError: Error = new Error('AI provider failed');
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await this.requestOnce(baseUrl, apiKey, model, context);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('AI provider failed');
        console.error(`[AI provider] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${lastError.message}`);
      }
    }
    throw lastError;
  }

  private async requestOnce(
    baseUrl: string,
    apiKey: string,
    model: string,
    context: AssignmentContext
  ): Promise<AssignmentResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: buildPrompt(context) }],
          response_format: { type: 'json_object' },
          temperature: 0,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`AI provider request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

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
      console.error(`[AI provider] response content was not valid JSON. Raw content:\n${content.slice(0, 2000)}`);
      throw new Error('AI provider returned invalid JSON');
    }

    if (!isValidResult(parsed)) {
      console.error(`[AI provider] response had an unexpected shape. Raw content:\n${content.slice(0, 2000)}`);
      throw new Error('AI provider returned an unexpected response shape');
    }

    return parsed;
  }
}

export const aiProvider: AIProvider = new OpenAICompatibleProvider();

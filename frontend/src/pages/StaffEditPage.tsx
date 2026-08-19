import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Staff } from '../api/client';
import { AppShell } from '../components/AppShell';
import { PageHeader } from '../components/PageHeader';
import { btnPillActive, btnPillInactive, btnPrimary, cardBase, errorText, inputBase, labelBase } from '../styles/ui';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function StaffEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [skills, setSkills] = useState('');
  const [minHours, setMinHours] = useState(0);
  const [maxHours, setMaxHours] = useState(40);
  const [preferredWeekdays, setPreferredWeekdays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.staff.get(id).then((s) => {
      setStaff(s);
      setName(s.name);
      setEmail(s.email);
      setSkills(s.skills.join(', '));
      if (s.preference) {
        setMinHours(s.preference.minHoursPerWeek);
        setMaxHours(s.preference.maxHoursPerWeek);
        setPreferredWeekdays(s.preference.preferredWeekdays);
      }
    });
  }, [id]);

  const toggleWeekday = (day: number) => {
    setPreferredWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    const skillList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api.staff.update(id, { name, email, skills: skillList });
      await api.staff.updatePreference(id, {
        preferredShiftTemplateIds: staff?.preference?.preferredShiftTemplateIds ?? [],
        unavailableDateRanges: staff?.preference?.unavailableDateRanges ?? [],
        minHoursPerWeek: minHours,
        maxHoursPerWeek: maxHours,
        preferredWeekdays,
      });
      navigate('/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff');
    }
  };

  if (!staff)
    return (
      <AppShell>
        <p className="text-sm text-ink-soft">加载中...</p>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="max-w-lg space-y-6">
        <PageHeader title="编辑员工" />
        <form onSubmit={handleSubmit} className={`${cardBase} space-y-4`}>
          {error && (
            <p role="alert" className={errorText}>
              {error}
            </p>
          )}
          <div>
            <label className={labelBase}>姓名</label>
            <input placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} className={inputBase} required />
          </div>
          <div>
            <label className={labelBase}>邮箱</label>
            <input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <div>
            <label className={labelBase}>技能</label>
            <input
              placeholder="技能（逗号分隔）"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className={inputBase}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelBase}>最小周工时</label>
              <input
                type="number"
                value={minHours}
                onChange={(e) => setMinHours(Number(e.target.value))}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>最大周工时</label>
              <input
                type="number"
                value={maxHours}
                onChange={(e) => setMaxHours(Number(e.target.value))}
                className={inputBase}
              />
            </div>
          </div>
          <div>
            <p className={labelBase}>偏好上班的星期几</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((label, day) => (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleWeekday(day)}
                  className={preferredWeekdays.includes(day) ? btnPillActive : btnPillInactive}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className={btnPrimary}>
            保存
          </button>
        </form>
      </div>
    </AppShell>
  );
}

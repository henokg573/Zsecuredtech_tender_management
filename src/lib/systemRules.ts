export type SystemRole = 'admin' | 'ceo' | 'manager' | 'staff';

export type TenderLike = {
  id?: number;
  tenderName: string;
  assignedPerson?: string;
  priority?: 'Low' | 'Medium' | 'High';
  closingDate?: string;
  status?: string;
  progressPercent?: number;
};

export const canManageBusinessRecords = (role: string | null | undefined) => {
  return role === 'admin' || role === 'ceo';
};

export const buildTenderTask = (tender: TenderLike) => {
  const title = tender.tenderName?.trim();
  if (!title || !tender.assignedPerson?.trim()) {
    return null;
  }

  return {
    id: String(tender.id ?? Date.now()),
    title,
    assignedTo: tender.assignedPerson.trim(),
    projectId: undefined,
    priority: tender.priority ?? 'Medium',
    dueDate: tender.closingDate || '',
    status: tender.status || 'New',
    progress: tender.progressPercent ?? 0,
    notes: 'Auto-created from tender assignment',
  };
};

export const computeStaffAnalytics = (users: any[], tenders: TenderLike[], tasks: any[] = [], now = new Date()) => {
  const byName = new Map<string, any>();
  users.forEach((user) => {
    byName.set(user.name, { ...user, total: 0, active: 0, won: 0, completionRate: 0, tasks: 0 });
  });

  tenders.forEach((tender) => {
    const person = tender.assignedPerson?.trim();
    if (!person || !byName.has(person)) return;
    const row = byName.get(person);
    row.total += 1;
    row.tasks += 1;
    if (tender.status && tender.status !== 'Completed' && tender.status !== 'Cancelled') {
      row.active += 1;
    }
    if (tender.status === 'Completed') {
      row.won += 1;
    }
    row.completionRate = row.total ? Math.round((row.won / row.total) * 100) : 0;
  });

  const asList = Array.from(byName.values()).map((user) => ({
    ...user,
    total: user.total,
    active: user.active,
    won: user.won,
    completionRate: user.completionRate,
    daily: [{ date: now.toISOString().slice(0, 10), total: user.tasks, status: user.active > 0 ? 'active' : 'idle' }],
    weekly: [{ date: 'This Week', total: user.tasks, successRate: user.completionRate }],
    quarterly: [{ period: 'Q3', total: user.tasks, successRate: user.completionRate }],
  }));

  return {
    daily: asList.map((user) => ({ id: user.id, name: user.name, role: user.role, total: user.total, active: user.active, won: user.won, completionRate: user.completionRate, date: now.toISOString().slice(0, 10) })),
    weekly: asList.map((user) => ({ id: user.id, name: user.name, role: user.role, total: user.total, successRate: user.completionRate, active: user.active })),
    quarterly: asList.map((user) => ({ id: user.id, name: user.name, role: user.role, total: user.total, successRate: user.completionRate, active: user.active })),
    summary: asList.map((user) => ({ id: user.id, name: user.name, role: user.role, total: user.total, won: user.won, active: user.active, completionRate: user.completionRate })),
  };
};

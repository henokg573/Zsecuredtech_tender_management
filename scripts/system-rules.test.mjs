import assert from 'node:assert/strict';
import { canManageBusinessRecords, buildTenderTask, computeStaffAnalytics } from '../src/lib/systemRules.js';

const adminOk = canManageBusinessRecords('admin');
assert.equal(adminOk, true, 'Admin should be allowed to manage projects and clients');
assert.equal(canManageBusinessRecords('staff'), false, 'Staff should not manage business records');

const tenderTask = buildTenderTask({
  id: 11,
  tenderName: 'Security Audit',
  assignedPerson: 'Henok G',
  priority: 'High',
  closingDate: '2026-08-25',
  status: 'In Progress',
  progressPercent: 25,
});
assert.equal(tenderTask?.title, 'Security Audit', 'Tender task should carry the tender title');
assert.equal(tenderTask?.assignedTo, 'Henok G', 'Tender task should be assigned to the tender assignee');

const analytics = computeStaffAnalytics(
  [
    { id: '1', name: 'Henok G', role: 'admin', initials: 'HG', email: '', telegram: '', telegramChatId: '', password: '', is_active: true },
    { id: '2', name: 'Gelassa A', role: 'staff', initials: 'GA', email: '', telegram: '', telegramChatId: '', password: '', is_active: true },
  ],
  [
    { id: 1, tenderName: 'Bid A', assignedPerson: 'Henok G', status: 'Completed', priority: 'High', closingDate: '2026-08-20', progressPercent: 100 },
    { id: 2, tenderName: 'Bid B', assignedPerson: 'Gelassa A', status: 'In Progress', priority: 'Medium', closingDate: '2026-09-08', progressPercent: 40 },
  ],
  [],
  new Date('2026-08-17T12:00:00Z')
);
assert.ok(analytics.daily.length >= 2, 'Analytics should contain daily progress for each staff member');
assert.ok(analytics.weekly.some((item) => item.name === 'Henok G'), 'Weekly analytics should include Henok');

console.log('system rules tests passed');

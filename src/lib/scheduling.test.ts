import { scheduledWeekdays, isScheduledOn, describeSchedule } from './scheduling';

describe('scheduledWeekdays', () => {
  it('treats daily variants as every day', () => {
    for (const f of ['diária', 'diaria', 'daily', 'Todo dia', '', null, undefined]) {
      expect(scheduledWeekdays(f)).toHaveLength(7);
    }
  });

  it('never schedules on-demand actions', () => {
    expect(scheduledWeekdays('sob demanda')).toEqual([]);
    expect(scheduledWeekdays('por ocorrência')).toEqual([]);
  });

  it('spreads N×/semana across fixed weekdays', () => {
    expect(scheduledWeekdays('1×/semana')).toEqual([6]);
    expect(scheduledWeekdays('2×/semana')).toEqual([2, 6]);
    expect(scheduledWeekdays('3×/semana')).toEqual([1, 3, 5]);
    expect(scheduledWeekdays('3x/semana')).toEqual([1, 3, 5]);
  });

  it('falls back to daily for unknown text', () => {
    expect(scheduledWeekdays('sempre que der')).toHaveLength(7);
  });
});

describe('isScheduledOn', () => {
  it('matches the weekday', () => {
    expect(isScheduledOn('3×/semana', 1)).toBe(true);
    expect(isScheduledOn('3×/semana', 2)).toBe(false);
    expect(isScheduledOn('diária', 0)).toBe(true);
    expect(isScheduledOn('sob demanda', 3)).toBe(false);
  });
});

describe('describeSchedule', () => {
  it('describes the schedule in Portuguese', () => {
    expect(describeSchedule('diária')).toBe('todo dia');
    expect(describeSchedule('1×/semana')).toBe('toda sáb');
    expect(describeSchedule('3×/semana')).toBe('seg, qua e sex');
    expect(describeSchedule('sob demanda')).toBe('quando acontecer');
  });
});

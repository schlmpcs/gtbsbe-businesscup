/** Thrown by engine functions whose body has not been written yet. `task` is the task ID (e.g. 'Y1'). */
export class NotImplementedError extends Error {
  readonly task: string;

  constructor(task: string) {
    super(`Not implemented yet (task ${task}). See docs/TASKS.md.`);
    this.name = 'NotImplementedError';
    this.task = task;
  }
}

/** Use as `throw notImplemented('Y1')` in a function body that a task will replace. */
export function notImplemented(task: string): NotImplementedError {
  return new NotImplementedError(task);
}

/** One writer per editor. Flush drains the newest draft before navigation. */
export function createSaveQueue<T>(initial: T, read: () => T, persist: (value: T) => Promise<void>) {
  let saved = JSON.stringify(initial);
  let active: Promise<void> | null = null;
  return {
    flush(): Promise<void> {
      if (active) return active;
      active = (async () => {
        while (true) {
          const value = read();
          const key = JSON.stringify(value);
          if (key === saved) return;
          await persist(value);
          saved = key; // acknowledgement only after confirmed database success
        }
      })().finally(() => { active = null; });
      return active;
    },
    reset(value: T) { if (active) throw Error("Cannot reset while saving"); saved = JSON.stringify(value); },
  };
}

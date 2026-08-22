export const saveCache = (key, data) => localStorage.setItem(key, JSON.stringify(data));
export const loadCache = (key) => {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
};

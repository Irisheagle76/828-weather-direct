let subs = [];

export function saveSubscription(sub) {
  const exists = subs.find(s => s.endpoint === sub.endpoint);
  if (!exists) subs.push(sub);
}

export function getAllSubscriptions() {
  return subs;
}
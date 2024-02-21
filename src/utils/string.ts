export function removePunctuationAndSpaces(str: string) {
  const regExp =
    /[\s\u3000-\u303f\uff00-\uffef\u2010-\u201f\u0020-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/g;
  return str.replace(regExp, "");
}

export function formatDuration(startTimeStamp: number, endTimeStamp: number) {
  let diff = endTimeStamp - startTimeStamp;
  if (diff < 1000) {
    return `${diff}ms`;
  } else if (diff < 60000) {
    return `${(diff / 1000).toFixed(2)}s`;
  } else {
    return `${(diff / 60000).toFixed(2)}m`;
  }
}

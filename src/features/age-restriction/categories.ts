/** Include the saved selection so legacy/custom names remain editable. */
export function categoryOptions(categories: string[], selected: string, query: string) {
  const unique = new Map<string, string>();
  for (const name of [...categories, selected]) {
    const trimmed = name.trim();
    if (trimmed && !unique.has(trimmed.toLocaleLowerCase('en-GB'))) unique.set(trimmed.toLocaleLowerCase('en-GB'), trimmed);
  }
  const search = query.trim().toLocaleLowerCase('en-GB');
  return {
    matches: [...unique.values()].filter(name => name.toLocaleLowerCase('en-GB').includes(search)).sort((a, b) => a.localeCompare(b)),
    canAdd: search.length > 0 && !unique.has(search),
  };
}

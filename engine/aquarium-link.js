// Keep the generated creature and its habitat together when opening the editor.
export function aquariumLink(state, { selected = state.fish[0].id } = {}) {
  
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  const encoded = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  const params = new URLSearchParams({ view: 'aquarium', selected: String(selected) });
  
  return `engine/index.html?${params}#a=${encoded}`;
}

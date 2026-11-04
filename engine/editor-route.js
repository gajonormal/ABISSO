
export function editorRoute(params, hasAquarium = false) {

  if (params.has('door') || params.get('view') === 'door') return 'landing';

  return hasAquarium || params.has('c') || params.has('view') ? 'aquarium' : 'landing';
}

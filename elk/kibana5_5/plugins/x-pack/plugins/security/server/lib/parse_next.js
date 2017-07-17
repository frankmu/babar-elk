import { parse } from 'url';

export function parseNext(href, basePath = '') {
  const { query, hash } = parse(href, true);
  if (!query.next) {
    return `${basePath}/`;
  }

  // validate that `next` is not attempting a redirect to somewhere
  // outside of this Kibana install
  const { protocol, hostname, port, pathname } = parse(query.next);
  if (protocol || hostname || port) {
    return `${basePath}/`;
  }
  if (!String(pathname).startsWith(basePath)) {
    return `${basePath}/`;
  }

  return query.next + (hash || '');
}
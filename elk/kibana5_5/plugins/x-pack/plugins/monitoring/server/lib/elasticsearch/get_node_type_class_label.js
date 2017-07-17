import { nodeTypeLabel, nodeTypeClass } from './lookups';

/*
 * Note: currently only `node` and `master` are supported due to
 * https://github.com/elastic/x-pack-kibana/issues/608
 */
export function getNodeTypeClassLabel(node) {
  const nodeType = node.master ? 'master' : node.type;
  const returnObj = {
    nodeType,
    nodeTypeLabel: nodeTypeLabel[nodeType],
    nodeTypeClass: nodeTypeClass[nodeType]
  };
  return returnObj;
}

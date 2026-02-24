export function sameSubnetCheck (ip1: string, ip2: string) {
  const ip1Array = ip1.split('.');
  const ip2Array = ip2.split('.');

  if (ip1Array.length !== 4 || ip2Array.length !== 4) return false;
  return ip1Array[0] === ip2Array[0] && ip1Array[1] === ip2Array[1] && ip1Array[2] === ip2Array[2];
}
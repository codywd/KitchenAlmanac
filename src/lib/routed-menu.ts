export type RouteParamValue = string | string[] | undefined;
export type RouteSearchParams = Record<string, RouteParamValue>;

export function firstRouteParam(value: RouteParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function routeParamValues(value: RouteParamValue) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}

export function routeWithParams(
  path: string,
  current: RouteSearchParams,
  next: Record<string, string | undefined>,
  hash?: string,
) {
  const params = new URLSearchParams();

  Object.entries(current).forEach(([key, value]) => {
    if (key in next) {
      return;
    }

    routeParamValues(value).forEach((item) => {
      params.append(key, item);
    });
  });

  Object.entries(next).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  const anchor = hash ? `#${hash}` : "";

  return `${path}${query ? `?${query}` : ""}${anchor}`;
}

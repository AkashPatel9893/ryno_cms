import { handle } from "@/lib/mock-api/handler";

type Context = { params: Promise<{ path?: string[] }> };
async function route(request: Request, context: Context) {
  const { path = [] } = await context.params;
  return handle(request, path);
}
export { route as GET, route as POST, route as PATCH, route as PUT, route as DELETE, route as OPTIONS };

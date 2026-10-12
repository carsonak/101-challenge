/** Read bounded API errors without displaying supplied or server-private values. */
export async function readResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.code ?? "UNAVAILABLE");

  return data;
}

import { api } from "./api";

export async function loginUser(username: string, password: string) {
  console.log("BaseURL:", api.defaults.baseURL);
  console.log("Headers:", api.defaults.headers);
  const res = await api.post("/auth/login/", { username, password });
  return res.data; // doit contenir access et refresh normalement
}

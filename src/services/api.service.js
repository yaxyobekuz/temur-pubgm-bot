import axios from "axios";
import { env } from "../config/env.js";

const api = axios.create({
  baseURL: env.API_BASE_URL,
  timeout: 10_000,
});

export default api;

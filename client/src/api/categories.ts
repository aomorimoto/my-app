import { apiFetch } from "./client";
import type { Category } from "../types";

export const fetchCategories = () =>
  apiFetch<{ categories: Category[] }>("/api/categories");

export const createCategory = (body: { name: string; color?: string }) =>
  apiFetch<{ category: Category }>("/api/categories", { method: "POST", body });

export const deleteCategory = (id: number) =>
  apiFetch<null>(`/api/categories/${id}`, { method: "DELETE" });

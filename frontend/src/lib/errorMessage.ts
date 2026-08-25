import axios from 'axios';

/** Lay thong diep loi de doc tu axios error, co gia tri du phong khi khong doan duoc. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && err.response?.data?.message) {
    return err.response.data.message as string;
  }
  return fallback;
}

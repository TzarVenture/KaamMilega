
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
console.log("NEXT_PUBLIC_API_URL", apiUrl);

const api = axios.create({
    baseURL: `${apiUrl}/api`,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request Interceptor: Attach Token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        if (typeof window !== "undefined") {
            const token = localStorage.getItem("token");
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle Errors
api.interceptors.response.use(
    (response) => {
        return response.data; // Return only data for cleaner usage
    },
    (error: AxiosError) => {
        if (error.response) {
            // Handle 401 Unauthorized
            if (error.response.status === 401) {
                if (typeof window !== "undefined") {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");

                    const currentPath = window.location.pathname;
                    const isPublicRoute = currentPath === "/" || currentPath.startsWith("/jobs");

                    // Redirect to login only if not already there AND not on a public route
                    if (!currentPath.includes("/login") && !isPublicRoute) {
                        window.location.href = "/login";
                    }
                }
            }

            // Return error response data if available, or a generic error
            const errorData: any = error.response.data;
            const message = errorData?.error || errorData?.message || "Something went wrong";
            return Promise.reject(new Error(message));
        } else if (error.request) {
            // Network error
            return Promise.reject(new Error("Network Error. Please check your connection."));
        } else {
            return Promise.reject(new Error(error.message));
        }
    }
);

export default api;

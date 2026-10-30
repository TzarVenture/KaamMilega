
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { isAuthPage, loginPathFor, signupResumePath } from "./authPaths";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
    baseURL: `${apiUrl}/api`,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

// Request Interceptor: Attach Token (keeps backwards compatibility for stored tokens)
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
            // Return error response data if available, or a generic error
            const errorData: any = error.response.data;
            const message = errorData?.error || errorData?.message || "Something went wrong";

            // Handle 401 Unauthorized (expired token, or own account no longer exists:
            // the backend answers 401 for a deleted user on /user/profile)
            if (error.response.status === 401) {
                if (typeof window !== "undefined") {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    document.cookie = "km_user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;";

                    const currentPath = window.location.pathname;
                    const isPublicRoute = currentPath === "/" || currentPath.startsWith("/jobs") || currentPath.startsWith("/mentorship");

                    // Sign in again on the right portal, then come back to this page
                    if (!isAuthPage(currentPath) && !isPublicRoute) {
                        window.location.href = loginPathFor(currentPath, window.location.search);
                    }
                }
            }

            // Verified the mobile but never finished sign-up: back to the step that is missing
            if (error.response.status === 403 && errorData?.code === "SIGNUP_INCOMPLETE" && typeof window !== "undefined") {
                const currentPath = window.location.pathname;
                if (!isAuthPage(currentPath)) {
                    window.location.href = signupResumePath(currentPath);
                }
            }

            // A deactivated or pending-deletion account can only reach the restore screen
            if (error.response.status === 403 && errorData?.code === "ACCOUNT_INACTIVE" && typeof window !== "undefined") {
                if (!window.location.pathname.startsWith("/account/restore")) {
                    window.location.href = "/account/restore";
                }
            }

            // Keep the HTTP status (and API error code) so callers can tell auth failures from other errors
            return Promise.reject(Object.assign(new Error(message), { status: error.response.status, code: errorData?.code }));
        } else if (error.request) {
            // Network error
            return Promise.reject(Object.assign(new Error("Network Error. Please check your connection."), { code: "NETWORK_ERROR" }));
        } else {
            return Promise.reject(new Error(error.message));
        }
    }
);

export default api;

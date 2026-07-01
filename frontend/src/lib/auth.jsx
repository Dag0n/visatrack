import { createContext, useContext, useEffect, useState } from "react";
import { pb } from "./pb";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(pb.authStore.isValid ? pb.authStore.record : null);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      pb.authStore.clear();
    }

    return pb.authStore.onChange(() => {
      setUser(pb.authStore.isValid ? pb.authStore.record : null);
    });
  }, []);

  async function login(email, password) {
    await pb.collection("users").authWithPassword(email, password);
  }

  async function signup(email, password) {
    await pb.collection("users").create({
      email,
      password,
      passwordConfirm: password,
    });
    await login(email, password);
  }

  async function loginWithOAuth2(provider) {
    await pb.collection("users").authWithOAuth2({ provider });
  }

  function logout() {
    pb.authStore.clear();
  }

  async function updateProfile(data) {
    await pb.collection("users").update(user.id, data);
  }

  async function deleteAccount() {
    await pb.collection("users").delete(user.id);
    logout();
  }

  async function claimEntries() {
    return pb.send("/api/custom/claim", { method: "POST" });
  }

  const value = {
    user,
    isLoggedIn: !!user && pb.authStore.isValid,
    login,
    signup,
    loginWithOAuth2,
    logout,
    updateProfile,
    deleteAccount,
    claimEntries,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

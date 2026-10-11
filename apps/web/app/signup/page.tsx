import AuthScreen from "../../components/auth-screen";

/** Dedicated signup flow with no unrelated authentication forms. */
export default function Page() {
  return <AuthScreen view="signup" />;
}

/** Safe route title contains no participant data. */
export const metadata = { title: "Create account" };

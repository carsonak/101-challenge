import AuthScreen from "../../components/auth-screen";

/** Dedicated login flow with no unrelated authentication forms. */
export default function Page() {
  return <AuthScreen view="login" />;
}

/** Safe route title contains no participant data. */
export const metadata = { title: "Log in" };

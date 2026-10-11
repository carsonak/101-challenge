import AuthScreen from "../../components/auth-screen";

/** Dedicated reset flow with no unrelated authentication forms. */
export default function Page() {
  return <AuthScreen view="reset" />;
}

/** Safe route title contains no participant data. */
export const metadata = { title: "Reset password" };

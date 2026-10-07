import AuthScreen from "../../components/auth-screen";

/** Dedicated reset flow with no unrelated authentication forms. */
export default function Page() {
  return <AuthScreen view="reset" />;
}

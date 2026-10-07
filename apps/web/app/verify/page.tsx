import AuthScreen from "../../components/auth-screen";

/** Dedicated verify flow with no unrelated authentication forms. */
export default function Page() {
  return <AuthScreen view="verify" />;
}

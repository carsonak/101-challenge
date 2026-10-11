import AuthScreen from "../../components/auth-screen";

/** Dedicated recover flow with no unrelated authentication forms. */
export default function Page() {
  return <AuthScreen view="recover" />;
}

/** Safe route title contains no participant data. */
export const metadata = { title: "Recover password" };

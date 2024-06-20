import type { LinksFunction, MetaFunction } from '@vercel/remix';
import { Form, useLoaderData, useNavigation } from '@remix-run/react';
import { getData } from '~/googleapis.server';
import { SocialsProvider } from 'remix-auth-socials';
import { authenticator } from '~/auth.server';
import styles from "./main.css?url";

// noinspection JSUnusedGlobalSymbols
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

// noinspection JSUnusedGlobalSymbols
export const meta: MetaFunction = () => {
  return [
    { title: "לומדים הלאה - שיבוץ שיעורים" },
    { name: "description", content: "מערכת לשיבוץ מורים ותלמידים בפרוייקט לומדים הלאה Learning On" },
  ];
};

export async function loader({ request }: { request: Request }) {
  const user = await authenticator.isAuthenticated(request);
  const data = await getData();
  const userEmail = user?._json.email;
  const isPermitted = data.coordinators?.[0]?.includes(userEmail ?? '');

  return {
    user,
    userEmail,
    isPermitted,
    ...data,
  };
}

export default function Index() {
  const { state } = useNavigation();
  const { students, teachers, user, isPermitted } = useLoaderData<typeof loader>();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>שיבוצי שיעורים</h1>
      {state === 'loading' && <h2>טוען נתונים...</h2>}
      {state === 'idle' && <div>
        {isPermitted && <div>
          students {students?.length}, teachers: {teachers?.length}
        </div>
        }

        {user && !isPermitted &&
           <Form
              method="post"
              action={`/logout`}
           >
             <h2>
               <div>שלום {user.displayName}, אין לך הרשאות להשתמש במערכת.</div>
               <button>יציאה</button>
             </h2>
           </Form>}

        {!user && <Form
           method="post"
           action={`/auth/${SocialsProvider.GOOGLE}`}
        >
          <h2>
            <div>כדי להשתמש במערכת יש להכנס.</div>
            <button>כניסה</button>
          </h2>
        </Form>}
      </div>}
    </div>
  )
    ;
}

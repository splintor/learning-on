import React, {
  useReducer,
  useState,
  type MouseEvent,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { LinksFunction, MetaFunction } from '@vercel/remix';
import { Form, useFetcher, useLoaderData } from '@remix-run/react';
import { assignStudent, assignTeacher, getData } from '~/googleapis.server';
import type { Student, Teacher, CityName } from '~/googleapis.server';
import { SocialsProvider } from 'remix-auth-socials';
import { authenticator } from '~/auth.server';
import styles from './main.css?url';
import { ToastContainer, Zoom, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// noinspection JSUnusedGlobalSymbols
export const links: LinksFunction = () => [{ rel: 'stylesheet', href: styles }];

// noinspection JSUnusedGlobalSymbols
export const meta: MetaFunction = () => {
  return [
    { title: 'לומדים הלאה - שיבוץ שיעורים' },
    {
      name: 'description',
      content: 'מערכת לשיבוץ מורים ותלמידים בפרוייקט לומדים הלאה Learning On',
    },
  ];
};

export async function loader({ request }: { request: Request }) {
  const user = await authenticator.isAuthenticated(request);
  const userEmail = user?._json.email;
  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPhone = process.env.OWNER_PHONE;
  if (!userEmail) {
    return {
      user,
      userEmail,
      userName: '?',
      userIsFemale: false,
      ownerEmail,
      ownerPhone,
      teachers: [],
      students: [],
    };
  }

  const { coordinators, teachers, students } = await getData();
  const userRow = coordinators?.find(c => c[1] === userEmail);
  const userName = userRow?.[0];
  const userIsFemale = userRow?.[2] === 'מצוותת';

  return {
    user,
    userEmail,
    userName,
    userIsFemale,
    ownerEmail,
    ownerPhone,
    teachers,
    students,
  };
}

// noinspection JSUnusedGlobalSymbols
export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const teacherIndex = Number(formData.get('teacherIndex'));
  const studentIndex = Number(formData.get('studentIndex'));
  const studentCity = String(formData.get('studentCity')) as CityName;
  const assignValue = String(formData.get('assignValue'));
  if (teacherIndex) {
    await assignTeacher({ teacherIndex, assignValue });
  } else {
    await assignStudent({ studentCity, studentIndex, assignValue });
  }
  return null;
}

const Available = 'זמין';

const isTeacherAvailable = (t: Teacher) => Boolean(t.openingCallWith);
const isTeacherAssigned = (t: Teacher) => Boolean(t.matchedStudent);
const getTeacherWhatsappMsg = (t: Teacher) =>
  `שלום ${t.name}, האם אפשר לשבץ אליך תלמידים לשיעורים פרטיים?`;
const getTeacherClass = (
  t: Teacher,
  selectedTeacher: Teacher | null | undefined
) =>
  [
    t === selectedTeacher ? 'selected' : '',
    isTeacherAssigned(t)
      ? 'assigned'
      : isTeacherAvailable(t)
      ? 'available'
      : '',
  ].join(' ');

const isStudentAvailable = (_s: Student) => true;
const isStudentAssigned = (s: Student) => Boolean(s.matchedTeacher);
const studentFirstAttachedTeacher = (s: Student) => s.matchedTeacher;

const formatJoinDate = (sOrT: Pick<Student | Teacher, 'creationTime'>) =>
  new Date(sOrT.creationTime).toLocaleDateString();

const formatHour = (h: string) =>
  h
    .replaceAll(/[\d:-]+ /g, '')
    .split('; ')
    .sort((a, b) => (a === 'בוקר' || b === 'ערב' ? -1 : 1))
    .join(', ');

function formatHours(
  sOrT: Pick<Student | Teacher, 'weekendHours' | 'weekDaysHours'>
) {
  const weekdays = formatHour(sOrT.weekDaysHours);
  const weekend = formatHour(sOrT.weekendHours);

  return weekdays === weekend ? (
    <div>{weekdays}</div>
  ) : (
    <>
      <div>{weekdays && 'א-ה: ' + weekdays}</div>
      <div>{weekend && 'סופ"ש: ' + weekend}</div>
    </>
  );
}

function studentMatchForTeacher(
  student: Student | null,
  teacher: Teacher | null
) {
  if (!student || !teacher) {
    return -2000;
  }

  if (
    student.studentClass.match(/[א-ו]/) &&
    !teacher.subjects.includes('יסודי')
  ) {
    return -1000;
  }
  if (
    student.studentClass.match(/[ז-ט]/) &&
    !teacher.subjects.includes('חטיבה')
  ) {
    return -1000;
  }
  if (
    student.studentClass.match(/(post|י|יא|יב)/) &&
    !teacher.subjects.includes('תיכון')
  ) {
    return -1000;
  }

  return (
    (teacher.subjects.includes(student.primarySubject) ? 2000 : 0) +
    (teacher.subjects.includes(student.secondarySubject) ? 1000 : 0)
  );
}

export default function Index() {
  const teacherFetcher = useFetcher({ key: 'assign-teacher' });
  const isTeacherFetcherIdle = teacherFetcher.state === 'idle';
  const studentFetcher = useFetcher({ key: 'assign-student' });
  const isStudentFetcherIdle = studentFetcher.state === 'idle';
  const { teachers, students, user, userEmail, ownerEmail, ownerPhone } =
    useLoaderData<typeof loader>();
  const [includeAssigned, setIncludeAssigned] = useState(false);
  const [displayedTeachers, setDisplayedTeachers] = useState<Teacher[] | null>(
    teachers as Teacher[]
  );
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>();
  const [matchingStudents, setMatchingStudents] = useState<Student[]>([]);
  const selectedTeacherRef = useRef<HTMLDivElement>(null);
  const studentsSwipeRef = useRef<HTMLDivElement>(null);
  const [studentAssignToast, setStudentAssignToast] = useState<ReactNode>();
  const [isAboutModalOpen, toggleAboutModalOpen] = useReducer(
    state => !state,
    false
  );
  const [isTeachersListModalOpen, toggleTeachersListModalOpen] = useReducer(
    state => !state,
    false
  );
  const [teachersSearch, setTeachersSearch] = useState<string>();

  useEffect(() => {
    if (teachers) {
      setDisplayedTeachers(
        (includeAssigned
          ? (teachers as Teacher[])
          : (teachers as Teacher[])?.filter(
              t =>
                !t || !isTeacherAssigned(t) || t.name === selectedTeacher?.name
            )) ?? []
      );
    }
  }, [includeAssigned, selectedTeacher?.name, teachers]);

  const getStudentWhatsappMsg = (s: Student) =>
    `שלום ${s.name}, האם אפשר לשבץ אליך מורה לשיעורים פרטיים?`;
  const getStudentClass = (s: Student) =>
    isStudentAssigned(s)
      ? 'assigned'
      : isStudentAvailable(s)
      ? 'available'
      : '';

  useEffect(() => {
    if (selectedTeacher) {
      setSelectedTeacher(
        displayedTeachers?.find(t => t?.name === selectedTeacher.name)
      );
    } else if (selectedTeacher !== null) {
      setSelectedTeacher(displayedTeachers?.[0]);
    }
  }, [displayedTeachers, selectedTeacher, teachers]);

  useEffect(() => {
    if (teachers?.length === 0 && !includeAssigned) {
      setIncludeAssigned(true);
    }
  }, [includeAssigned, teachers?.length]);

  useEffect(() => {
    if (selectedTeacher && selectedTeacherRef.current) {
      setTimeout(() =>
        selectedTeacherRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start',
        })
      );
    }
  }, [selectedTeacher]);

  useEffect(() => {
    if (isTeacherFetcherIdle && studentAssignToast) {
      toast.success(studentAssignToast);
      setStudentAssignToast(undefined);
    }
  }, [studentAssignToast, isTeacherFetcherIdle]);

  useEffect(() => {
    if (!selectedTeacher) {
      setMatchingStudents([]);
    } else {
      const matchedStudent =
        selectedTeacher.matchedStudent &&
        students.find(s => s?.name === selectedTeacher.matchedStudent);
      if (matchedStudent) {
        setMatchingStudents([matchedStudent]);
      } else {
        const bestMatchingStudents = students
          .filter(s => !s || !isStudentAssigned(s))
          .map(s => ({
            student: s,
            match: studentMatchForTeacher(s, selectedTeacher),
          }))
          .sort((s1, s2) => s2.match - s1.match)
          .slice(0, 50)
          .map(({ student }) => student) as Student[];
        setMatchingStudents(bestMatchingStudents);
      }
    }
  }, [selectedTeacher, students]);

  useEffect(() => {
    if (studentsSwipeRef.current) {
      studentsSwipeRef.current.scrollLeft = 0;
    }
  }, [selectedTeacher?.name]);

  function assignTeacher(e: MouseEvent, t: Teacher, assignValue: string) {
    e.stopPropagation();
    e.preventDefault();
    teacherFetcher.submit(
      { teacherIndex: t.index, assignValue },
      { method: 'POST' }
    );
  }

  function assignStudent(e: MouseEvent, s: Student, assignValue: string) {
    e.stopPropagation();
    e.preventDefault();
    studentFetcher.submit(
      { studentIndex: s.index, studentCity: s.city, assignValue },
      { method: 'POST' }
    );

    const origValue = studentFirstAttachedTeacher(s) || '';
    const cancelFn = () => assignStudent(e, s, origValue);
    if (isStudentAssigned(s)) {
      setStudentAssignToast(
        <div className="toast">
          השיבוץ של {s.name} ל{selectedTeacher?.name} בוטל בהצלחה.{' '}
          <a href={'#re-assign'} onClick={cancelFn}>
            שבץ מחדש
          </a>
        </div>
      );
    } else if (assignValue && assignValue !== Available) {
      setStudentAssignToast(
        <div className="toast">
          {s.name} שובץ בהצלחה ל{selectedTeacher?.name}
          <a href={'#re-assign'} onClick={cancelFn}>
            בטל
          </a>
        </div>
      );
    }
    // s.teacher = assignValue;
  }

  return (
    <div className="root">
      <h1 onClick={toggleAboutModalOpen}>לומדים הלאה - מערכת שיבוץ</h1>
      {displayedTeachers ? (
        <div className="main">
          {displayedTeachers.length > 0 && (
            <div className="teachers-section">
              <div className="teachers-header">
                <a
                  href={'#teacher-list'}
                  onClick={e => {
                    e.preventDefault();
                    toggleTeachersListModalOpen();
                  }}
                >
                  רשימת מורים
                </a>
              </div>
              <div className="teachers swipe-list">
                {displayedTeachers.map(
                  t =>
                    t && (
                      <div
                        key={`TL-${t.index}`}
                        className={getTeacherClass(t, selectedTeacher)}
                        onClick={() =>
                          setSelectedTeacher(current =>
                            current === t ? null : t
                          )
                        }
                      >
                        <div className="right">
                          <div
                            ref={
                              t === selectedTeacher ? selectedTeacherRef : null
                            }
                            className="selection-element"
                          />
                          <div className="name">
                            <a
                              href={`/contact/${t.name}/${t?.phoneNumber}`}
                              onClick={e => e.stopPropagation()}
                            >
                              {t.name}
                            </a>
                          </div>
                          <div className="details">
                            <div>{t.subjects}</div>
                            {formatHours(t)}
                          </div>
                          <div className="insights">
                            {t.openingCallInsights}
                          </div>
                        </div>
                        <div className="left">
                          <div className="leftTop">
                            <div className="contact">
                              <span>
                                <a
                                  href={`tel:${t.phoneNumber}`}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {t.phoneNumber}
                                </a>
                                <a
                                  href={`https://wa.me/${
                                    t.phoneNumber
                                  }?text=${getTeacherWhatsappMsg(t)}`}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <img alt="WhatsApp" src="/whatsapp.svg" />
                                </a>
                              </span>
                            </div>
                            {
                              <div className="joinDate">
                                {formatJoinDate(t)}
                              </div>
                            }
                          </div>
                          <div className="leftBottom">
                            <div className="status">
                              {isTeacherAssigned(t)
                                ? 'משובץ'
                                : isTeacherAvailable(t)
                                ? 'זמין'
                                : 'לא זמין'}
                            </div>
                            {!isTeacherAssigned(t) && (
                              <div>
                                {isTeacherFetcherIdle ? (
                                  isTeacherAvailable(t) ? (
                                    <a
                                      href={'#markAsAvailable'}
                                      onClick={e => assignTeacher(e, t, '')}
                                    >
                                      סמן כלא זמין
                                    </a>
                                  ) : (
                                    <a
                                      href={'#markAsUnavailable'}
                                      onClick={e =>
                                        assignTeacher(e, t, Available)
                                      }
                                    >
                                      סמן כזמין
                                    </a>
                                  )
                                ) : (
                                  <div>מעדכן...</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                )}
              </div>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={includeAssigned}
                    onChange={() => setIncludeAssigned(v => !v)}
                  />
                  הצג גם מורים שכבר צוותו
                </label>
              </div>
            </div>
          )}

          {matchingStudents.length > 0 && (
            <div className="students-section">
              <div className="students-header">
                {isStudentAssigned(matchingStudents[0])
                  ? 'תלמידים שמשובצים ל'
                  : 'תלמידים שרלוונטיים לשיבוץ ל'}
                <span>{selectedTeacher?.name}</span>
              </div>
              <div className="students swipe-list" ref={studentsSwipeRef}>
                {matchingStudents.map(s => (
                  <div
                    key={`S-${s.city}-${s.index}`}
                    className={getStudentClass(s)}
                  >
                    <div className="right">
                      <div className="name">
                        <a
                          href={`/contact/${s.name}/${s.phoneNumber}`}
                          onClick={e => e.stopPropagation()}
                        >
                          {s.name}
                        </a>
                        <span className="grade">
                          ({s.city}, {s.studentClass})
                        </span>
                      </div>
                      <div className="details">
                        <div>{s.primarySubject}</div>
                        <div>{s.secondarySubject}</div>
                        {formatHours(s)}
                      </div>
                    </div>
                    <div className="left">
                      <div className="leftTop">
                        <div className="contact">
                          <span>
                            <a
                              href={`tel:${s.phoneNumber}`}
                              onClick={e => e.stopPropagation()}
                            >
                              {s.phoneNumber}
                            </a>
                            <a
                              href={`https://wa.me/${
                                s.phoneNumber
                              }?text=${getStudentWhatsappMsg(s)}`}
                              onClick={e => e.stopPropagation()}
                            >
                              <img alt="WhatsApp" src="/whatsapp.svg" />
                            </a>
                          </span>
                        </div>
                        {<div className="joinDate">{formatJoinDate(s)}</div>}
                      </div>

                      <div className="leftBottom">
                        {isStudentFetcherIdle ? (
                          <>
                            <div className="status">
                              {isStudentAssigned(s)
                                ? `משובץ ל${studentFirstAttachedTeacher(s)}`
                                : isStudentAvailable(s)
                                ? 'זמין'
                                : 'לא זמין'}
                            </div>
                            <div>
                              {!isStudentAssigned(s) && (
                                <div>
                                  {isStudentAvailable(s) ? (
                                    <a
                                      href={'#markAsAvailable'}
                                      onClick={e => assignStudent(e, s, '')}
                                    >
                                      סמן כלא זמין
                                    </a>
                                  ) : (
                                    <a
                                      href={'#markAsUnavailable'}
                                      onClick={e =>
                                        assignStudent(e, s, Available)
                                      }
                                    >
                                      סמן כזמין
                                    </a>
                                  )}
                                </div>
                              )}
                              <div>
                                {isStudentAssigned(s) ? (
                                  <a
                                    href={'#unassignStudent'}
                                    onClick={e => assignStudent(e, s, '')}
                                  >
                                    בטל שיבוץ ל{studentFirstAttachedTeacher(s)}
                                  </a>
                                ) : (
                                  <a
                                    href={'#assignStudent'}
                                    onClick={e =>
                                      assignStudent(e, s, selectedTeacher!.name)
                                    }
                                  >
                                    שבץ ל{selectedTeacher?.name}
                                  </a>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div>מעדכן...</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user && !teachers?.length && (
            <Form method="post" action={`/logout`} className="message warning">
              <h2>
                <div>
                  שלום {user.displayName}, אין מורים שמצוותים אליך במערכת.
                </div>
                <button>יציאה</button>
              </h2>
            </Form>
          )}

          {!user && (
            <Form
              method="post"
              action={`/auth/${SocialsProvider.GOOGLE}`}
              className="message"
            >
              <h2>
                <div>כדי להשתמש במערכת יש להכנס.</div>
                <button>כניסה</button>
              </h2>
            </Form>
          )}
          <ToastContainer
            position="bottom-center"
            autoClose={5000}
            hideProgressBar
            newestOnTop={false}
            closeOnClick
            rtl
            pauseOnFocusLoss
            draggable={false}
            pauseOnHover
            theme="light"
            transition={Zoom}
          />
        </div>
      ) : (
        <h2 className="loader">טוען נתונים...</h2>
      )}
      <div className={`about modal ${isAboutModalOpen ? 'open' : ''}`}>
        <div className="close" onClick={toggleAboutModalOpen}>
          <img alt="Close" src="/close.svg" />
        </div>
        <h2>
          מערכת השיבוץ של מיזם{' '}
          <a href="https://www.learningon.org/">לומדים הלאה</a> נכתבה ב
          <a href="https://github.com/splintor/learning-on">קוד פתוח</a> בידי{' '}
          <a href={`mailto:${ownerEmail}`}>שמוליק פלינט</a>{' '}
          <a
            className="whatsapp"
            href={`https://wa.me/${ownerPhone}?text=שלום שמוליק, זה בקשר למערכת השיבוץ של לומדים הלאה.`}
          >
            <img alt="WhatsApp" src="/whatsapp.svg" height={40} />
          </a>
          .
        </h2>
        {user && (
          <div>
            <h2>
              המצוות הנוכחי הוא
              <br />
              <a href={`mailto:${userEmail}`}>{user.displayName}</a>
            </h2>
            <Form method="post" action={`/logout`}>
              <button onClick={toggleAboutModalOpen}>יציאה</button>
            </Form>
          </div>
        )}
      </div>
      <div
        className={`teachers-list modal ${
          isTeachersListModalOpen ? 'open' : ''
        }`}
      >
        <div className="close" onClick={toggleTeachersListModalOpen}>
          <img alt="Close" src="/close.svg" />
        </div>
        <h4>רשימת מורים</h4>
        <div className="search">
          <input
            type="search"
            placeholder="חיפוש"
            onInput={e =>
              setTeachersSearch((e.target as HTMLInputElement).value)
            }
          />
        </div>
        <div className="list">
          {teachers
            ?.filter(
              t =>
                !teachersSearch ||
                teachersSearch
                  .split(' ')
                  .filter(Boolean)
                  .every(term => t?.name.includes(term))
            )
            .map(
              t =>
                t && (
                  <div
                    key={`T-${t.index}`}
                    onClick={() => {
                      toggleTeachersListModalOpen();
                      if (
                        isTeacherAssigned(t) &&
                        !displayedTeachers?.includes(t)
                      ) {
                        setIncludeAssigned(true);
                      }
                      setSelectedTeacher(t);
                    }}
                  >
                    <div>{t.name}</div>
                    <div className="status">
                      {isTeacherAssigned(t)
                        ? 'משובץ'
                        : isTeacherAvailable(t)
                        ? 'זמין'
                        : 'לא זמין'}
                    </div>
                  </div>
                )
            )}
        </div>
      </div>
    </div>
  );
}

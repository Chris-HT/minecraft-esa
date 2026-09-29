export type Edition = "java" | "bedrock";

export interface Signup {
  mcName: string;
  edition: Edition;
  email: string;
  formGroup: string;
}

export type Field = "password" | "mcName" | "edition" | "email" | "formGroup" | "consent";

/** What the student typed, trimmed, for re-showing the form. */
export interface FormValues {
  mcName?: string;
  edition?: string;
  email?: string;
  formGroup?: string;
  consent?: boolean;
}

/** Form fields as posted (HTML names). */
export type RawForm = Partial<Record<"mc_name" | "edition" | "email" | "form_group" | "consent", string>>;

export type Validation =
  | { ok: true; signup: Signup; values: FormValues }
  | { ok: false; errors: Partial<Record<Field, string>>; values: FormValues };

const JAVA_NAME = /^[A-Za-z0-9_]{3,16}$/;
const BEDROCK_NAME = /^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/;
const ESA_EMAIL = /^[a-z0-9._%+-]+@esa\.ac$/;

export function validateSignup(raw: RawForm): Validation {
  const values: FormValues = {
    mcName: (raw.mc_name ?? "").trim(),
    edition: raw.edition,
    email: (raw.email ?? "").trim().toLowerCase(),
    formGroup: (raw.form_group ?? "").trim(),
    consent: raw.consent !== undefined,
  };
  const errors: Partial<Record<Field, string>> = {};
  const name = values.mcName!;

  if (values.edition !== "java" && values.edition !== "bedrock") {
    errors.edition = "Choose Java or Bedrock.";
  }
  if (name === "") {
    errors.mcName = "Enter your Minecraft name.";
  } else if (values.edition === "java" && !JAVA_NAME.test(name)) {
    errors.mcName = "A Java name is 3 to 16 letters, numbers or _.";
  } else if (values.edition === "bedrock" && (name.length > 16 || !BEDROCK_NAME.test(name))) {
    errors.mcName = "A Bedrock name is up to 16 letters or numbers, with single spaces.";
  }
  if (values.email!.length > 254 || !ESA_EMAIL.test(values.email!)) {
    errors.email = "Use your school email, ending in @esa.ac.";
  }
  if (values.formGroup!.length < 1 || values.formGroup!.length > 10) {
    errors.formGroup = "Enter your form group, e.g. 10B.";
  }
  if (!values.consent) {
    errors.consent = "Tick the box to say your parent or guardian knows.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return {
    ok: true,
    signup: { mcName: name, edition: values.edition as Edition, email: values.email!, formGroup: values.formGroup! },
    values,
  };
}

/** Constant-time comparison. An empty expected password matches nothing. */
export function passwordMatches(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0 && b.length > 0;
}

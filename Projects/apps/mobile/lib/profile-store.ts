import AsyncStorage from "@react-native-async-storage/async-storage";

export type LocalProfile = {
  phone: string;
  company: string;
  jobTitle: string;
  emergencyContact: string;
  avatarUri: string;
};

const PROFILE_KEY = "sitesnap.profile";

export const DEFAULT_PROFILE: LocalProfile = {
  phone: "",
  company: "",
  jobTitle: "",
  emergencyContact: "",
  avatarUri: "",
};

export async function getLocalProfile() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    return {
      phone: parsed.phone || "",
      company: parsed.company || "",
      jobTitle: parsed.jobTitle || "",
      emergencyContact: parsed.emergencyContact || "",
      avatarUri: parsed.avatarUri || "",
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveLocalProfile(profile: LocalProfile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

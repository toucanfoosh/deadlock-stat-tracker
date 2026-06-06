export function steamId64FromProfile(profile: {
  steam_id?: string;
  profileurl?: string;
}): string | null {
  if (profile.steam_id) {
    return String(profile.steam_id);
  }

  const profileUrl = profile.profileurl;
  if (!profileUrl) {
    return null;
  }

  const match = profileUrl.match(/\/profiles\/(\d+)/);
  return match?.[1] ?? null;
}

export interface MoodProfile {
  keywords: string[];
  genres: string[];
  playlistSearchTerms: string[];
}

const WEATHER_MOODS: Record<string, MoodProfile> = {
  sunny: {
    keywords: ["happy", "upbeat", "summer", "feel good", "bright"],
    genres: ["pop", "dance", "funk"],
    playlistSearchTerms: ["summer", "sunny", "happy", "good vibes", "upbeat"],
  },
  clear: {
    keywords: ["happy", "upbeat", "summer", "feel good", "bright"],
    genres: ["pop", "dance", "funk"],
    playlistSearchTerms: ["summer", "sunny", "happy", "good vibes"],
  },
  cloudy: {
    keywords: ["chill", "indie", "mellow", "laid back"],
    genres: ["indie", "alternative", "soft rock"],
    playlistSearchTerms: ["chill", "indie", "mellow", "relaxed"],
  },
  overcast: {
    keywords: ["chill", "indie", "mellow", "laid back"],
    genres: ["indie", "alternative", "soft rock"],
    playlistSearchTerms: ["chill", "indie", "mellow"],
  },
  foggy: {
    keywords: ["ambient", "dreamy", "ethereal", "atmospheric"],
    genres: ["ambient", "dream pop", "shoegaze"],
    playlistSearchTerms: ["ambient", "dreamy", "atmospheric", "foggy"],
  },
  rainy: {
    keywords: ["rainy day", "acoustic", "cozy", "melancholy", "calm"],
    genres: ["jazz", "acoustic", "blues", "lo-fi"],
    playlistSearchTerms: ["rainy", "rain", "cozy", "acoustic", "lo-fi"],
  },
  drizzle: {
    keywords: ["lo-fi", "acoustic", "calm", "soft"],
    genres: ["lo-fi", "acoustic", "singer-songwriter"],
    playlistSearchTerms: ["lo-fi", "calm", "acoustic"],
  },
  snowy: {
    keywords: ["peaceful", "winter", "soft", "piano", "cozy"],
    genres: ["classical", "ambient", "piano"],
    playlistSearchTerms: ["winter", "snow", "peaceful", "cozy", "piano"],
  },
  stormy: {
    keywords: ["intense", "powerful", "storm", "epic", "dramatic"],
    genres: ["rock", "metal", "electronic"],
    playlistSearchTerms: ["storm", "intense", "rock", "powerful", "epic"],
  },
  thunderstorm: {
    keywords: ["intense", "powerful", "storm", "epic", "dramatic"],
    genres: ["rock", "metal", "electronic"],
    playlistSearchTerms: ["storm", "intense", "rock", "powerful"],
  },
  windy: {
    keywords: ["free", "uplifting", "folk", "acoustic"],
    genres: ["folk", "indie folk", "acoustic"],
    playlistSearchTerms: ["folk", "free", "uplifting", "wind"],
  },
  hot: {
    keywords: ["tropical", "summer", "dance", "party", "energetic"],
    genres: ["reggaeton", "tropical", "dance", "pop"],
    playlistSearchTerms: ["summer", "tropical", "party", "hot"],
  },
  cold: {
    keywords: ["cozy", "warm", "acoustic", "fireplace", "winter"],
    genres: ["acoustic", "folk", "jazz"],
    playlistSearchTerms: ["cozy", "warm", "winter", "acoustic"],
  },
};

export function weatherToMood(
  weather: string,
  temperature?: number
): MoodProfile {
  const normalized = weather.toLowerCase().trim();

  let profile = WEATHER_MOODS[normalized];
  if (!profile) {
    for (const [key, value] of Object.entries(WEATHER_MOODS)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        profile = value;
        break;
      }
    }
  }
  if (!profile) {
    profile = WEATHER_MOODS.cloudy;
  }

  if (temperature !== undefined) {
    if (temperature >= 30) {
      return {
        keywords: [...new Set([...profile.keywords, "energetic", "summer", "tropical"])],
        genres: [...new Set([...profile.genres, "dance", "pop"])],
        playlistSearchTerms: [...new Set([...profile.playlistSearchTerms, "summer", "energetic"])],
      };
    }
    if (temperature <= 5) {
      return {
        keywords: [...new Set([...profile.keywords, "cozy", "warm", "calm"])],
        genres: [...new Set([...profile.genres, "acoustic", "jazz"])],
        playlistSearchTerms: [...new Set([...profile.playlistSearchTerms, "cozy", "winter"])],
      };
    }
  }

  return profile;
}

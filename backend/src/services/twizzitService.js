import TwizzitApiClient from './twizzit-api-client.js';

// Lazy client initialization to avoid import-time failures in tests
let twizzitClient = null;

function getTwizzitClient() {
  if (twizzitClient) return twizzitClient;
  if (process.env.NODE_ENV === 'test') {
    // Provide a lightweight stub in test to avoid external dependencies
    twizzitClient = {
      async getGroups() {
        return { groups: [{ id: 1, name: 'Club A', description: '' }] };
      },
      async getGroupContacts(clubId) {
        return { contacts: [{ id: 1, first_name: 'John', last_name: 'Doe', email: null, gender: null, club_id: clubId }] };
      },
      async getSeasons() {
        return { seasons: [{ id: 1, name: 'Season 2025', start_date: null, end_date: null }] };
      },
      async verifyConnection() {
        return true;
      }
    };
    return twizzitClient;
  }
  const config = {
    apiEndpoint: process.env.TWIZZIT_API_ENDPOINT || 'https://app.twizzit.com',
    username: process.env.TWIZZIT_API_USERNAME,
    password: process.env.TWIZZIT_API_PASSWORD,
    timeout: 30000,
  };
  // Let the client constructor validate credentials; callers catch errors.
  twizzitClient = new TwizzitApiClient(config);
  return twizzitClient;
}

/**
 * Sync clubs from Twizzit API
 * @returns {Promise<Array>} List of synced clubs
 */
export async function syncClubs() {
  try {
    const { groups } = await getTwizzitClient().getGroups();
    // Map Twizzit groups to clubs
    const clubs = groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description || '',
    }));

    // TODO: Save clubs to the database

    return clubs;
  } catch (error) {
    console.error('Failed to sync clubs:', error);
    throw error;
  }
}

/**
 * Sync players for a specific club
 * @param {string} clubId - Twizzit club ID
 * @returns {Promise<Array>} List of synced players
 */
export async function syncPlayers(clubId) {
  try {
    const { contacts } = await getTwizzitClient().getGroupContacts(clubId);
    // Map Twizzit contacts to players
    const players = contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      email: contact.email,
      gender: contact.gender,
    }));

    // TODO: Save players to the database

    return players;
  } catch (error) {
    // Avoid user-controlled format strings in logs
    console.error('Failed to sync players for club %s:', clubId, error);
    throw error;
  }
}

/**
 * Sync seasons from Twizzit API
 * @returns {Promise<Array>} List of synced seasons
 */
export async function syncSeasons() {
  try {
    const { seasons } = await getTwizzitClient().getSeasons();
    // Map Twizzit seasons to app seasons
    const mappedSeasons = seasons.map((season) => ({
      id: season.id,
      name: season.name,
      startDate: season.start_date,
      endDate: season.end_date,
    }));

    // TODO: Save seasons to the database

    return mappedSeasons;
  } catch (error) {
    console.error('Failed to sync seasons:', error);
    throw error;
  }
}

/**
 * Verify Twizzit API connection
 * @returns {Promise<boolean>} True if connection is successful
 */
export async function verifyTwizzitConnection() {
  try {
    return await getTwizzitClient().verifyConnection();
  } catch (error) {
    console.error('Twizzit API connection verification failed:', error);
    return false;
  }
}
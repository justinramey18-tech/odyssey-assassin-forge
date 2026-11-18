import { describe, expect, it } from 'vitest';
import {
  journeyPaces, parseTravelOffers, previewJourney, resolveTravelTarget, stripTravelTags, travelButtonLabel, travelChoices,
  travelFactsForDm, travelPlaceNames, travelTimeText,
} from '@/lib/travel-offers';
import { buildEmpyreanStarterAtlas } from '@/lib/empyreanCanon/continentMap';
import { exitToParent, type CampaignAtlas } from '@/lib/campaign-atlas';

/** The starter atlas: the rider stands in Basgiath's courtyard, inside the Basgiath area of The Continent. */
function starter(): { inside: CampaignAtlas; outside: CampaignAtlas; rootMapId: string; basgiathMapId: string } {
  const built = buildEmpyreanStarterAtlas('camp-1');
  const out = exitToParent(built.atlas);
  if (typeof out === 'string') throw new Error(out);
  return { inside: built.atlas, outside: out, rootMapId: built.rootMapId, basgiathMapId: built.basgiathMapId };
}

describe('travel offers: the tag', () => {
  it('reads up to two offers with their verbs, and the story hides them', () => {
    const post = 'The order is clear.\n<!--TRAVEL:Montserrat|ride for Montserrat.-->\n<!--TRAVEL: Calldyr City -->\n<!--TRAVEL:Samara|a third-->\n<!--TRAVEL:montserrat|again-->';
    expect(parseTravelOffers(post)).toEqual([{ place: 'Montserrat', verb: 'ride for Montserrat' }, { place: 'Calldyr City', verb: '' }]);
    expect(stripTravelTags(post)).toBe('The order is clear.\n\n\n\n');
    expect(parseTravelOffers('No tags here.')).toEqual([]);
    expect(parseTravelOffers(null)).toEqual([]);
  });
});

describe('travel offers: matching a place to something the rider can do', () => {
  it('inside Basgiath: a spot is a move, the map above is leaving, a place on the map above is leaving then a journey', () => {
    const { inside, rootMapId } = starter();
    const choices = travelChoices(inside);
    expect(choices.leave).toBe('The Continent');
    expect(choices.here.length).toBeGreaterThan(3);
    expect(choices.here).not.toContain('Courtyard');
    expect(choices.beyond).toContain('Montserrat');
    const spot = resolveTravelTarget(inside, choices.here[0]);
    expect(spot).toMatchObject({ kind: 'move', name: choices.here[0] });
    expect(resolveTravelTarget(inside, 'the continent')).toEqual({ kind: 'leave', parentMapId: rootMapId, name: 'The Continent' });
    expect(resolveTravelTarget(inside, 'Montserrat')).toMatchObject({ kind: 'leave-journey', parentMapId: rootMapId, locationId: 'montserrat', name: 'Montserrat' });
  });

  it('out on the continent: a discovered place is a journey, the area where the rider stands can be entered', () => {
    const { outside, basgiathMapId } = starter();
    expect(resolveTravelTarget(outside, 'montserrat')).toEqual({ kind: 'journey', locationId: 'montserrat', name: 'Montserrat' });
    expect(resolveTravelTarget(outside, 'Calldyr')).toMatchObject({ kind: 'journey', locationId: 'calldyr' });
    expect(resolveTravelTarget(outside, 'Basgiath War College')).toEqual({ kind: 'enter', childMapId: basgiathMapId, name: 'Basgiath War College' });
    expect(travelChoices(outside)).toMatchObject({ area: 'Basgiath War College', leave: null, beyond: [] });
  });

  it('unknown, undiscovered and already-here places give nothing, and nothing is offered mid-journey', () => {
    const { inside, outside, rootMapId } = starter();
    expect(resolveTravelTarget(outside, 'Atlantis')).toBeNull();
    expect(resolveTravelTarget(outside, 'Aretia')).toBeNull(); // on the map, not discovered
    expect(resolveTravelTarget(inside, 'Courtyard')).toBeNull();
    expect(resolveTravelTarget(outside, '')).toBeNull();
    const onTheRoad: CampaignAtlas = { ...outside, maps: outside.maps.map(m => (m.id === rootMapId ? { ...m, state: { ...m.state, currentRoutePosition: { routeId: 'road-basgiath-montserrat', progress: 0.4 } } } : m)) };
    expect(resolveTravelTarget(onTheRoad, 'Montserrat')).toBeNull();
    expect(travelChoices(onTheRoad)).toEqual({ here: [], area: null, leave: null, beyond: [] });
    expect(travelFactsForDm(onTheRoad)).toContain('No travel can be offered right now');
  });
});

describe('travel offers: the confirm', () => {
  it('previews a journey from where the rider would stand, by road and by air', () => {
    const { inside, outside } = starter();
    const far = resolveTravelTarget(inside, 'Samara');
    if (!far) throw new Error('Samara should be reachable');
    const road = previewJourney(inside, far, 'normal');
    expect(road?.summary.locationNames).toEqual(['Basgiath War College', 'Montserrat', 'Samara']);
    expect(road?.summary.remainingMiles ?? 0).toBeGreaterThan(50);
    const air = previewJourney(inside, far, 'flying');
    expect(air?.plan.legs).toHaveLength(1);
    expect(air?.summary.remainingMinutes ?? 0).toBeLessThan(road?.summary.remainingMinutes ?? 0);
    const near = resolveTravelTarget(outside, 'Montserrat');
    if (!near) throw new Error('Montserrat should be reachable');
    expect(previewJourney(outside, near, 'normal')?.plan.legs).toHaveLength(1);
    const move = resolveTravelTarget(inside, travelChoices(inside).here[0]);
    if (!move) throw new Error('A spot inside Basgiath should resolve');
    expect(previewJourney(inside, move, 'normal')).toBeNull();
  });

  it('offers the map\'s own pace first, and flying only to a bonded rider', () => {
    const { outside } = starter();
    const t = resolveTravelTarget(outside, 'Montserrat');
    if (!t) throw new Error('Montserrat should be reachable');
    expect(journeyPaces(outside, t, true)[0]).toBe('flying');
    expect(journeyPaces(outside, t, true)).toEqual(expect.arrayContaining(['normal', 'horseback', 'flying']));
    expect(journeyPaces(outside, t, false)).toEqual(['normal', 'horseback']);
  });

  it('labels and times read plainly', () => {
    const { outside } = starter();
    const t = resolveTravelTarget(outside, 'Montserrat');
    if (!t) throw new Error('Montserrat should be reachable');
    expect(travelButtonLabel({ place: 'Montserrat', verb: 'ride for Montserrat' }, t)).toBe('Ride for Montserrat');
    expect(travelButtonLabel({ place: 'Montserrat', verb: '' }, t)).toBe('Travel to Montserrat');
    expect(travelButtonLabel({ place: 'x', verb: '' }, { kind: 'enter', childMapId: 'c', name: 'The Archives' })).toBe('Enter The Archives');
    expect(travelTimeText(12)).toBe('about 12 minutes');
    expect(travelTimeText(300)).toBe('about 5 hours');
    expect(travelTimeText(1500)).toBe('about 25 hours on the move (4 travel days)');
  });
});

describe('travel offers: what the DM and NPCs are told', () => {
  it('the DM gets the rule, the tag and the exact names; NPCs get the names', () => {
    const { inside } = starter();
    const facts = travelFactsForDm(inside);
    expect(facts).toContain('Only the app moves the rider');
    expect(facts).toContain('<!--TRAVEL:Place name|short verb phrase-->');
    expect(facts).toContain('- Out to the wider map: The Continent');
    expect(facts).toContain('Montserrat');
    expect(facts).not.toContain('use the Map');
    expect(facts).not.toContain('Aretia');
    const names = travelPlaceNames(inside);
    expect(names).toContain('Montserrat');
    expect(names).not.toContain('The Continent');
  });
});

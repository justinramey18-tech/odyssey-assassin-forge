// Built-in portraits for the canon Fourth Wing cast, keyed by cast key.
import violet from '@/assets/npc-portraits/violet-sorrengail.jpg';
import xaden from '@/assets/npc-portraits/xaden-riorson.jpg';
import liam from '@/assets/npc-portraits/liam-mairi.jpg';
import rhiannon from '@/assets/npc-portraits/rhiannon-matthias.jpg';
import ridoc from '@/assets/npc-portraits/ridoc-gamlyn.jpg';
import sawyer from '@/assets/npc-portraits/sawyer-henrick.jpg';
import imogen from '@/assets/npc-portraits/imogen-cardulo.jpg';
import garrick from '@/assets/npc-portraits/garrick-tavis.jpg';
import mira from '@/assets/npc-portraits/mira-sorrengail.jpg';
import brennan from '@/assets/npc-portraits/brennan-sorrengail.jpg';
import lilith from '@/assets/npc-portraits/lilith-sorrengail.jpg';
import dain from '@/assets/npc-portraits/dain-aetos.jpg';
import jack from '@/assets/npc-portraits/jack-barlowe.jpg';
import sloane from '@/assets/npc-portraits/sloane-mairi.jpg';
import aaric from '@/assets/npc-portraits/aaric-graycastle.jpg';
import melgren from '@/assets/npc-portraits/augustine-melgren.jpg';
import panchek from '@/assets/npc-portraits/lyron-panchek.jpg';
import varrish from '@/assets/npc-portraits/burton-varrish.jpg';
import markham from '@/assets/npc-portraits/lewis-markham.jpg';
import kaori from '@/assets/npc-portraits/kaori.jpg';
import carr from '@/assets/npc-portraits/carr.jpg';
import emetterio from '@/assets/npc-portraits/emetterio.jpg';
import devera from '@/assets/npc-portraits/devera.jpg';
import catriona from '@/assets/npc-portraits/catriona-cordella.jpg';
import syrena from '@/assets/npc-portraits/syrena-cordella.jpg';
import tecarus from '@/assets/npc-portraits/viscount-tecarus.jpg';
import maren from '@/assets/npc-portraits/maren-zina.jpg';
import bodhi from '@/assets/npc-portraits/bodhi-durran.jpg';
import jesinia from '@/assets/npc-portraits/jesinia-neilwart.jpg';
import visia from '@/assets/npc-portraits/visia-hawelynn.jpg';
import tara from '@/assets/npc-portraits/tara.jpg';
import nolon from '@/assets/npc-portraits/nolon-colbersy.jpg';
import winifred from '@/assets/npc-portraits/winifred.jpg';
import nyra from '@/assets/npc-portraits/nyra-voldaren.jpg';
import quinn from '@/assets/npc-portraits/quinn-hollis.jpg';
import trager from '@/assets/npc-portraits/trager-karis.jpg';
import drake from '@/assets/npc-portraits/drake-cordella.jpg';
import bragen from '@/assets/npc-portraits/bragen.jpg';
import kai from '@/assets/npc-portraits/kai.jpg';
import cianna from '@/assets/npc-portraits/cianna.jpg';
import heaton from '@/assets/npc-portraits/heaton.jpg';
import emery from '@/assets/npc-portraits/emery-barnes.jpg';
import nadine from '@/assets/npc-portraits/nadine.jpg';
import eya from '@/assets/npc-portraits/eya.jpg';
import mason from '@/assets/npc-portraits/mason.jpg';
import neve from '@/assets/npc-portraits/neve.jpg';
import luella from '@/assets/npc-portraits/luella.jpg';

export const CAST_PORTRAITS: Record<string, string> = {
  'violet-sorrengail': violet, 'xaden-riorson': xaden, 'liam-mairi': liam, 'rhiannon-matthias': rhiannon,
  'ridoc-gamlyn': ridoc, 'sawyer-henrick': sawyer, 'imogen-cardulo': imogen, 'garrick-tavis': garrick,
  'mira-sorrengail': mira, 'brennan-sorrengail': brennan, 'lilith-sorrengail': lilith, 'dain-aetos': dain,
  'jack-barlowe': jack, 'sloane-mairi': sloane, 'aaric-graycastle': aaric,
  'augustine-melgren': melgren, 'lyron-panchek': panchek, 'burton-varrish': varrish, 'lewis-markham': markham,
  'kaori': kaori, 'carr': carr, 'emetterio': emetterio, 'devera': devera,
  'catriona-cordella': catriona, 'syrena-cordella': syrena, 'viscount-tecarus': tecarus, 'maren-zina': maren,
  'bodhi-durran': bodhi, 'jesinia-neilwart': jesinia, 'visia-hawelynn': visia, 'tara': tara,
  'nolon-colbersy': nolon, 'winifred': winifred, 'nyra-voldaren': nyra, 'quinn-hollis': quinn,
  'trager-karis': trager, 'drake-cordella': drake, 'bragen': bragen, 'kai': kai,
  'cianna': cianna, 'heaton': heaton, 'emery-barnes': emery, 'nadine': nadine,
  'eya': eya, 'mason': mason, 'neve': neve, 'luella': luella,
};

export function castPortrait(key: string): string | undefined {
  return CAST_PORTRAITS[key];
}

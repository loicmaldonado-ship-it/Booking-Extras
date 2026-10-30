import test from 'node:test';
import assert from 'node:assert/strict';
import { construireRapport, nettoyerChemin, nettoyerTexte, familleNavigateur } from '../src/lib/observabilite/rapport-erreur.ts';

const SECRETS = ['hunter2-secret', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N', 'lou.martin@example.fr',
  '06 12 34 56 78', '9f0c2b1a-1111-4222-8333-444455556666', 'abcdefABCDEF0123456789abcdefABCDEF012345'];

test('le chemin perd sa query et ses tokens publics', () => {
  assert.equal(nettoyerChemin('/postuler/9f0c2b1a-1111-4222-8333-444455556666?email=a@b.fr#x'), '/postuler/:id');
  assert.equal(nettoyerChemin('/partage/documents/AbCdEfGhIjKlMnOpQrStUvWx/fiches'), '/partage/documents/:id/fiches');
  assert.equal(nettoyerChemin('/bookings/nouveau'), '/bookings/nouveau');
  assert.equal(nettoyerChemin(undefined), '/');
});

test('un secret placé dans une erreur de test n\'apparaît pas dans le rapport', () => {
  const err = new Error(`échec password=${SECRETS[0]} Bearer ${SECRETS[1]} pour ${SECRETS[2]} tél ${SECRETS[3]} id ${SECRETS[4]} clé ${SECRETS[5]}`);
  err.digest = '12345';
  const r = construireRapport({ source: 'serveur', erreur: err, chemin: `/compte/verifier?token=${SECRETS[5]}`, methode: 'POST',
    routePath: '/compte/verifier', routeType: 'action', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' });
  const json = JSON.stringify(r);
  for (const s of SECRETS) assert.ok(!json.includes(s), `fuite : ${s}`);
  assert.equal(r.route, '/compte/verifier');
  assert.equal(r.digest, '12345');
  assert.equal(r.navigateur, 'Safari/iOS');
  assert.match(r.pile, /qa08-rapport-erreur/);
  assert.ok(r.release && r.env);
});

test('textes tronqués et valeurs non chaîne tolérées', () => {
  assert.ok(nettoyerTexte('x'.repeat(2000)).length <= 501);
  assert.equal(nettoyerTexte(null), '');
  assert.equal(familleNavigateur(42), '?/?');
  assert.equal(construireRapport({ source: 'navigateur', erreur: 'boom' }).message, 'boom');
});

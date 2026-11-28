# Inspection statique RLS / Server Actions — non exhaustive

Lecture du code SQL et TypeScript de l’archive `main` (8 octobre 2026). **Cette inspection ne tient pas compte de l’état réel de la base après migrations** et ne prouve pas une vulnérabilité exploitable.

## Anciennes déclarations de politiques « authenticated full access » (27)

Des migrations ultérieures peuvent avoir supprimé/remplacé ces politiques. Rejouer l’historique sur une base isolée pour connaître les politiques effectives.

| Migration | Ligne | Déclaration trouvée |
|---|---:|---|
| `20260813000001_figurants.sql` | 82 | `create policy "authenticated full access" on public.figurants` |
| `20260813000001_figurants.sql` | 85 | `create policy "authenticated full access" on public.figurant_photos` |
| `20260813000001_figurants.sql` | 88 | `create policy "authenticated full access" on public.figurant_liens` |
| `20260813000002_projets.sql` | 39 | `create policy "authenticated full access" on public.projets` |
| `20260813000003_annonces_candidatures.sql` | 30 | `create policy "authenticated full access" on public.annonces` |
| `20260813000003_annonces_candidatures.sql` | 66 | `create policy "authenticated full access" on public.candidatures` |
| `20260813000004_bookings.sql` | 48 | `create policy "authenticated full access" on public.bookings` |
| `20260813000006_bareme_acfda.sql` | 68 | `create policy "authenticated full access" on public.bareme_cachets` |
| `20260813000006_bareme_acfda.sql` | 70 | `create policy "authenticated full access" on public.bareme_majorations` |
| `20260813000007_multi_comptes.sql` | 26 | `create policy "authenticated full access" on public.profiles` |
| `20260813000007_multi_comptes.sql` | 50 | `create policy "authenticated full access" on public.projet_membres` |
| `20260813000008_essayages.sql` | 32 | `create policy "authenticated full access" on public.essayages` |
| `20260817000002_journees_rls.sql` | 3 | `create policy "authenticated full access" on public.journees` |
| `20260817000006_message_templates.sql` | 20 | `create policy "authenticated full access" on public.message_templates` |
| `20260817000008_profil_adresse_disponibilites.sql` | 24 | `create policy "authenticated full access" on public.figurant_indisponibilites` |
| `20260819000010_essayage_creneaux.sql` | 19 | `create policy "authenticated full access" on public.essayage_creneaux` |
| `20260820000001_candidature_onglets_figurant_confirme.sql` | 47 | `create policy "authenticated full access" on public.candidature_onglets` |
| `20260823000001_indemnites.sql` | 28 | `create policy "authenticated full access" on public.projet_indemnites` |
| `20260823000001_indemnites.sql` | 30 | `create policy "authenticated full access" on public.booking_indemnites` |
| `20260827000001_booking_majorations.sql` | 20 | `create policy "authenticated full access" on public.booking_majorations` |
| `20260828000002_essayage_lieu_projet.sql` | 16 | `create policy "authenticated full access" on public.essayage_lieux` |
| `20260828000004_notifications.sql` | 21 | `create policy "authenticated full access" on public.notifications` |
| `20260830000001_document_templates.sql` | 16 | `create policy "authenticated full access" on public.document_templates` |
| `20260831000001_casting.sql` | 49 | `create policy "authenticated full access" on public.casting_entries` |
| `20260911000008_casting_presentiel.sql` | 38 | `create policy "authenticated full access" on public.casting_presentiel_creneaux` |
| `20260911000008_casting_presentiel.sql` | 69 | `create policy "authenticated full access" on public.casting_presentiel_entries` |
| `20260911000012_agents_base.sql` | 22 | `create policy "authenticated full access" on public.agents` |

## Modules `"use server"` utilisant `createAdminClient()` (39)

Une présence d’un contrôle dans un module ne garantit **pas** que chaque export est protégé ; une absence dans ce relevé peut correspondre à une fonction publique intentionnelle. Audit manuel par fonction et par ressource requis.

| Module | Exports détectés | Contrôle mentionné dans le fichier | Fonctions exportées |
|---|---:|---|---|
| `src/lib/admin/actions.ts` | 4 | Oui (à vérifier pour chaque export) | inviteChef, revokeChefAccess, restoreChefAccess, resendChefInvite |
| `src/lib/agents/actions.ts` | 6 | Oui (à vérifier pour chaque export) | searchAgents, upsertAgent, listAgents, createAgent, updateAgent, deleteAgent |
| `src/lib/annonces/actions.ts` | 4 | Oui (à vérifier pour chaque export) | createAnnonce, updateAnnonce, deleteAnnonce, toggleAnnonceStatut |
| `src/lib/annonces/dates.ts` | 3 | Oui (à vérifier pour chaque export) | getAnnonceDates, addAnnonceDate, removeAnnonceDate |
| `src/lib/annonces/moodboard-actions.ts` | 2 | Oui (à vérifier pour chaque export) | addAnnoncePhoto, removeAnnoncePhoto |
| `src/lib/annonces/questions.ts` | 4 | Oui (à vérifier pour chaque export) | getQuestionTemplates, getAnnonceQuestions, addAnnonceQuestion, removeAnnonceQuestion |
| `src/lib/auth/avatar-actions.ts` | 1 | Oui (à vérifier pour chaque export) | updateMyAvatar |
| `src/lib/auth/email-actions.ts` | 2 | Oui (à vérifier pour chaque export) | updateMyGmailSmtp, updateMyEmailTemplates |
| `src/lib/auth/profile-actions.ts` | 1 | Oui (à vérifier pour chaque export) | updateMyProfile |
| `src/lib/auth/support.ts` | 2 | Oui (à vérifier pour chaque export) | entrerModeSupport, quitterModeSupport |
| `src/lib/bareme/actions.ts` | 8 | Oui (à vérifier pour chaque export) | createBaremeCachet, updateBaremeCachet, deleteBaremeCachet, createBaremeMajoration, updateBaremeMajoration, deleteBaremeMajoration, applyMajorationToBookings, removeMajorationFromBooking |
| `src/lib/bookings/actions.ts` | 20 | Oui (à vérifier pour chaque export) | createBooking, updateBooking, deleteBooking, createBookingFromDrop, createBookingsFromDropBulk, createJournee, deleteJournee, updateTotalJournee, updateConvocationSettings, removeBooking, bulkUpdateBookings, moveBookingsToDate, markConvocationEnvoyee, resetConvocationEnvoyee, recordConvocationMessage, recordBookingMessage, copyCovoiturageToDate, recordCovoiturageMessage, sendBulkConvocations, sendEspacePersoLinkBulk |
| `src/lib/bookings/besoins-actions.ts` | 2 | Oui (à vérifier pour chaque export) | addBesoin, deleteBesoin |
| `src/lib/bookings/pdt-actions.ts` | 4 | Oui (à vérifier pour chaque export) | apercuModificationPdt, modifierPdt, prevenirProfilsPdt, supprimerJourneeBasculee |
| `src/lib/bookings/photos-actions.ts` | 2 | Oui (à vérifier pour chaque export) | chargerChoixPhotos, enregistrerChoixPhotos |
| `src/lib/candidats/actions.ts` | 14 | Oui (à vérifier pour chaque export) | requestMagicLink, loginWithPassword, setMaPassword, logoutFigurant, markMessageBienRecu, subscribeToPush, unsubscribeFromPush, activerAccesCompte, toggleAccesCompte, updateMaFiche, addIndisponibiliteSelf, removeIndisponibiliteSelf, uploadMaPhoto, deleteMaPhoto |
| `src/lib/candidats/inscription.ts` | 1 | Non détecté statiquement | inscrireCandidat |
| `src/lib/candidatures/actions.ts` | 8 | Oui (à vérifier pour chaque export) | recordCandidatureMessage, postulerAnnonce, updateCandidature, setCandidatureOnglet, setCandidaturesOngletBulk, createCandidatureOnglet, getCandidatureTriData, deleteCandidatureOnglet |
| `src/lib/candidatures/jours.ts` | 2 | Oui (à vérifier pour chaque export) | setCandidatureJour, envoyerJourAuTournage |
| `src/lib/casting/actions.ts` | 24 | Oui (à vérifier pour chaque export) | createCastingRole, updateCastingRoleCalibration, deleteCastingRole, addFigurantToCastingRole, listCastingRolesForProjet, addFigurantsToCastingRole, updateCastingEntryMode, updateCastingEntryNotes, updateCastingEntryVisiblePartage, updateCastingRoleVisiblePartage, setCastingRolePosition, updateAllCastingEntriesVisiblePartage, updateCastingEntriesStatutBulk, updateCastingEntryStatut, deleteCastingEntry, deleteCastingPhoto, addCastingPhoto, removeCastingVideo, createStaffCastingVideoSlot, addCastingVideo, updateCastingVideoLabel, setCastingVideoPosition, recordCastingMessage, recordCastingMessagesBulk |
| `src/lib/casting/upload-actions.ts` | 3 | Non détecté statiquement | logCastingUploadEvent, createCastingUploadSlot, finalizeCastingUpload |
| `src/lib/casting-presentiel/actions.ts` | 14 | Oui (à vérifier pour chaque export) | createPresentielJournee, deletePresentielJournee, updatePresentielLieu, addFigurantToPresentielJournee, updatePresentielEntryRole, updatePresentielEntryNotes, sendFigurantsToPresentiel, removePresentielEntry, updatePresentielStatut, updatePresentielStatutBulk, addPresentielCreneau, generatePresentielCreneaux, removePresentielCreneau, assignPresentielEntryToCreneau |
| `src/lib/documents/template-actions.ts` | 2 | Oui (à vérifier pour chaque export) | updateDocumentTemplate, removeDocumentTemplateLogo |
| `src/lib/equipe/actions.ts` | 3 | Oui (à vérifier pour chaque export) | inviteAssistant, revokeAccess, updateAssistantSections |
| `src/lib/essayages/actions.ts` | 18 | Oui (à vérifier pour chaque export) | uploadTenuePhoto, recordEssayageMessage, createEssayage, updateEssayage, deleteEssayage, createEssayageJournee, updateEssayageLieuProjet, updateEssayageLieu, addFigurantToEssayageJournee, sendFigurantsToEssayage, updateEssayageStatutInline, updateEssayageReponseRecue, removeEssayageFromJournee, moveEssayagesToJournee, addCreneau, generateCreneaux, removeCreneau, assignFigurantToCreneau |
| `src/lib/figurants/actions.ts` | 10 | Oui (à vérifier pour chaque export) | createFigurant, updateFigurant, updateFigurantInline, updateFigurantAgent, deleteFigurant, supprimerFigurantDoublon, uploadFigurantPhoto, deletePhoto, deleteLien, mergeFigurants |
| `src/lib/figurants/disponibilites.ts` | 3 | Oui (à vérifier pour chaque export) | addIndisponibilite, getIndisponibilitesForFigurants, removeIndisponibilite |
| `src/lib/figurants/edit.ts` | 1 | Oui (à vérifier pour chaque export) | getFigurantForEdit |
| `src/lib/figurants/messages-actions.ts` | 3 | Oui (à vérifier pour chaque export) | sendStaffMessageToFigurant, notifyFigurantByEmail, toggleMessageRepondu |
| `src/lib/figurants/preview.ts` | 1 | Oui (à vérifier pour chaque export) | getFigurantPreview |
| `src/lib/indemnites/actions.ts` | 4 | Oui (à vérifier pour chaque export) | createProjetIndemnite, deleteProjetIndemnite, applyIndemniteToBookings, removeIndemniteFromBooking |
| `src/lib/notifications/actions.ts` | 3 | Oui (à vérifier pour chaque export) | getNotificationsPanel, markNotificationsLues, markAllNotificationsLues |
| `src/lib/partage/actions.ts` | 10 | Oui (à vérifier pour chaque export) | getPartageToken, getPartageTitre, updatePartageTitre, createPartageLien, updateCastingDocVisible, updateFichesRolesMasquerContact, revokePartageLien, getJourneePartageLien, createJourneePartageLien, revokeJourneePartageLien |
| `src/lib/projets/actions.ts` | 6 | Oui (à vérifier pour chaque export) | createProjet, updateProjet, deleteProjet, archiverProjet, desarchiverProjet, countProjetTemporaires |
| `src/lib/projets/annonce-photo-actions.ts` | 2 | Oui (à vérifier pour chaque export) | updateProjetAnnoncePhoto, removeProjetAnnoncePhoto |
| `src/lib/references/actions.ts` | 5 | Oui (à vérifier pour chaque export) | ajouterReference, modifierReference, basculerReferenceVisible, supprimerReference, deplacerReference |
| `src/lib/rgpd/actions.ts` | 1 | Oui (à vérifier pour chaque export) | anonymiserFigurant |
| `src/lib/search/actions.ts` | 1 | Oui (à vérifier pour chaque export) | searchGlobal |
| `src/lib/templates/actions.ts` | 3 | Oui (à vérifier pour chaque export) | createTemplate, updateTemplate, deleteTemplate |

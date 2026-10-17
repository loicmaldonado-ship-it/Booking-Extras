-- Booking Extras — envoi d'un texto par l'app Messages du Mac.
-- Arguments : numéro (+33…), texte, mode (« sms » ou « imessage »).
-- Mode « sms » : passe par l'iPhone (Transfert de SMS) si disponible, sinon
-- iMessage. Mode « verifier » : ne fait que lister les comptes (sert à
-- déclencher l'autorisation macOS à l'installation).
on run argv
	set numero to item 1 of argv
	set texte to item 2 of argv
	set modeEnvoi to item 3 of argv
	tell application "Messages"
		if modeEnvoi is "verifier" then
			set listeTypes to {}
			repeat with unCompte in (every account)
				try
					set end of listeTypes to (service type of unCompte) as text
				end try
			end repeat
			return listeTypes as text
		end if
		-- Comptes vérifiés un par un : sur certains Mac, lire le type d'un
		-- compte échoue (-10000) et ferait tout basculer en iMessage
		-- (« Non distribué » pour les numéros sans iMessage).
		set leService to missing value
		if modeEnvoi is "sms" then
			repeat with unCompte in (every account)
				try
					if (service type of unCompte) is SMS and (enabled of unCompte) then
						set leService to contents of unCompte
						exit repeat
					end if
				end try
			end repeat
		end if
		if leService is missing value then
			repeat with unCompte in (every account)
				try
					if (service type of unCompte) is iMessage and (enabled of unCompte) then
						set leService to contents of unCompte
						exit repeat
					end if
				end try
			end repeat
		end if
		if leService is missing value then error "Aucun compte Messages utilisable (SMS ou iMessage)."
		set leContact to participant numero of leService
		send texte to leContact
	end tell
	return "ok"
end run

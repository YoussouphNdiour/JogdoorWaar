export const metadata = { title: "Conditions d'utilisation — Jog Door Waar" };

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
        Conditions d&apos;utilisation
      </h1>
      <p className="text-sm text-gray-500 mb-10">Dernière mise à jour : mars 2026</p>

      <section className="space-y-8 text-base leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold mb-2">1. Objet</h2>
          <p>
            Jog Door Waar (« le Service ») est une plateforme d&apos;agrégation d&apos;offres d&apos;emploi
            destinée au marché sénégalais. En accédant au Service, vous acceptez les présentes
            conditions d&apos;utilisation.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">2. Inscription</h2>
          <p>
            L&apos;accès aux fonctionnalités complètes nécessite la création d&apos;un compte. Vous êtes
            responsable de la confidentialité de vos identifiants et de toutes les activités
            réalisées depuis votre compte.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">3. Utilisation acceptable</h2>
          <p>Il est interdit d&apos;utiliser le Service pour :</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Publier des offres d&apos;emploi frauduleuses ou trompeuses</li>
            <li>Collecter des données personnelles d&apos;autres utilisateurs sans consentement</li>
            <li>Tenter de contourner les mécanismes de sécurité du Service</li>
            <li>Envoyer des communications non sollicitées (spam)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">4. Abonnements et paiements</h2>
          <p>
            Les plans Premium (3 500 FCFA/mois) et Recruteur (15 000 FCFA/mois) sont facturés
            mensuellement. Les paiements sont traités via Wave, Orange Money ou Stripe. Aucun
            remboursement n&apos;est accordé pour les périodes déjà entamées.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">5. Propriété intellectuelle</h2>
          <p>
            Les offres d&apos;emploi sont la propriété de leurs employeurs respectifs. Jog Door Waar
            détient les droits sur son interface, ses algorithmes de matching et ses outils IA.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">6. Limitation de responsabilité</h2>
          <p>
            Jog Door Waar agrège des offres provenant de sources tierces et ne garantit pas leur
            exactitude. Nous ne sommes pas partie aux contrats de travail conclus via la
            plateforme.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">7. Modification des conditions</h2>
          <p>
            Nous nous réservons le droit de modifier ces conditions à tout moment. Les
            utilisateurs seront notifiés par email 15 jours avant toute modification substantielle.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">8. Contact</h2>
          <p>
            Pour toute question : <a href="mailto:contact@jogdoorwaar.sn" className="underline text-orange-600">contact@jogdoorwaar.sn</a>
          </p>
        </div>
      </section>
    </main>
  );
}

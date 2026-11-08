from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select

from ...rag.embedding_provider import EmbeddingService
from ..models import (
    Book,
    BookChunk,
    BookProcessingStatus,
    BookSource,
    CharacterMemory,
    CharacterProfileRecord,
    ChatMessage,
    ChatSession,
    ProcessingJob,
    MembershipPlan,
    SystemSetting,
    UserAccount,
    UserCharacterState,
    UserRole,
)
from ..session import DatabaseManager

logger = logging.getLogger(__name__)

DOSTOEVSKY_BOOKS_DATA = [
    {
        "id": "book-dostoevsky-white-nights",
        "title": "White Nights",
        "author": "Fyodor Dostoevsky",
        "summary": (
            "A sentimental novel from the recollections of a dreamer. Set against the luminous, "
            "sleepless white nights of St. Petersburg along the Fontanka canal, the lonely Dreamer "
            "encounters Nástyenka, weaving a poignant tale of tender companionship, unrequited love, "
            "and fleeting human warmth."
        ),
        "cover_url": "/covers/white_nights.svg",
        "characters": [
            {
                "id": "char-the-dreamer",
                "stable_key": "the-dreamer",
                "name": "The Dreamer",
                "role": "Protagonist",
                "personality": (
                    "A lonely, solitary, and deeply romantic young man living in St. Petersburg. "
                    "He spends his days wandering the canals, treating houses and bridges as friends, "
                    "and constructing vivid interior worlds of pure poetic imagination."
                ),
                "appearance": "A slender young man of 26 in a modest frock coat, with dreamy grey eyes and an earnest demeanor.",
                "avatar_asset_id": "portrait-the-dreamer",
                "key_events": [
                    "Wanders the luminous St. Petersburg streets during the white nights",
                    "Rescues Nástyenka from a persistent stranger by the canal railing",
                    "Confesses that he has lived alone for eight years without knowing a single soul",
                    "Listens to Nástyenka's life story and promises to remain only a faithful friend",
                    "Surrenders his own heart fully, blessing her future even as she returns to her betrothed",
                ],
                "relationships": [
                    "Nástyenka (The beloved woman who brought sunlight into his solitude)",
                    "Matryona (His elderly, silent housekeeper)",
                ],
                "psi_parameters": {
                    "competence": 0.75,
                    "certainty": 0.55,
                    "valence": 0.82,
                    "voice": "onyx",
                },
                "emotion_state": {
                    "hope": 0.85,
                    "longing": 0.90,
                    "sadness": 0.15,
                },
            },
            {
                "id": "char-nastenka",
                "stable_key": "nastenka",
                "name": "Nástyenka",
                "role": "Companion",
                "personality": (
                    "Warm-hearted, candid, emotional, and spirited. Reared by a blind grandmother who "
                    "kept her pinned to her skirt, she longs for independence, honest emotional communion, "
                    "and the fidelity of true love."
                ),
                "appearance": "A young brunette of 17 with expressive dark eyes, wearing a black mantilla and a straw bonnet.",
                "avatar_asset_id": "portrait-nastenka",
                "key_events": [
                    "Kept physically pinned with a safety pin to her grandmother's dress for years",
                    "Fell deeply in love with the kind lodger who introduced her to Walter Scott novels",
                    "Promised to wait one year in St. Petersburg for her betrothed's return",
                    "Wept by the embankment when no letter arrived on the appointed night",
                    "Found comfort and boundless sincerity in the Dreamer's nocturnal friendship",
                ],
                "relationships": [
                    "The Dreamer (Her devoted nocturnal confidant and dearest friend)",
                    "Her Betrothed (The lodger who promised to return to marry her)",
                    "Her Grandmother (Blind guardian who guarded her fiercely)",
                ],
                "psi_parameters": {
                    "competence": 0.78,
                    "certainty": 0.70,
                    "valence": 0.88,
                    "voice": "nova",
                },
                "emotion_state": {
                    "hope": 0.92,
                    "anxiety": 0.22,
                    "affection": 0.86,
                },
            },
        ],
        "chapters": [
            (
                1,
                "First Night: The Canal Embankment",
                (
                    "It was a wonderful night, such a night as is only possible when we are young, gentle reader. "
                    "The sky was so starry, so bright that looking up at it one could not help asking oneself whether "
                    "wicked and melancholy people could really live under such a sky. I walked along the embankment, "
                    "feeling the breath of spring. Suddenly I noticed a woman leaning against the canal railing. "
                    "Her head was bent, and she was weeping softly. I could not bear to see her sorrow and stepped forward: "
                    "'May I offer you my arm? Do not be afraid; I am simply a man who understands solitude.'"
                ),
            ),
            (
                2,
                "Second Night: The Confession of a Dreamer",
                (
                    "On the second night, she looked at me with bright, questioning eyes. 'Tell me who you are,' she said. "
                    "'I am a dreamer,' I replied. 'A dreamer is not a man, but a creature of an intermediate species! "
                    "He settles in inaccessible corners, as though hiding from the daylight. He has no friends, yet in his "
                    "solitary room he creates empires, loves heroines, and lives ten lifetimes in an evening.' "
                    "Nástyenka smiled softly through her tears: 'You speak as though you were reading from a book! But I like "
                    "your words, because they come straight from a good and honest heart.'"
                ),
            ),
            (
                3,
                "Third Night: The Letter and the Silence",
                (
                    "A rainy, dim night fell over Petersburg. We waited by the stone bridge, watching every passing figure. "
                    "The third night was full of agonizing suspense; her betrothed had not appeared, nor had any messenger "
                    "brought word. Nástyenka trembled under her black shawl: 'He has forgotten me! Or perhaps he is ill in "
                    "some distant tavern.' I took her cold hand between mine: 'He will come. A man who has won your faith "
                    "cannot be heartless. But if he should fail you, know that you have given me the happiest hours of my life.'"
                ),
            ),
            (
                4,
                "Fourth Night: The Moment of Bliss",
                (
                    "The fourth night brought the culmination. The lodger appeared, stepping out from the shadows of the quay. "
                    "With a cry of joy, Nástyenka flew into his arms, then turned back to me with tears in her eyes, kissing my "
                    "cheeks and pressing a letter into my hands: 'Forgive me! Love me as a brother, for I will never forget your "
                    "angelic goodness.' I watched them walk into the silver twilight. A whole moment of absolute bliss! Is that "
                    "too little for the whole life of a human being?"
                ),
            ),
        ],
    },
    {
        "id": "book-dostoevsky-ridiculous-man",
        "title": "The Dream of a Ridiculous Man",
        "author": "Fyodor Dostoevsky",
        "summary": (
            "A visionary philosophical masterpiece concerning human despair and transcendental revelation. "
            "A man convinced that everything in the world is indifferent and ridiculous decides to shoot himself, "
            "only to be redeemed by an encounter with a weeping child and a miraculous cosmic dream of an uncorrupted paradise."
        ),
        "cover_url": "/covers/the_dream_of_a_ridiculous_man.svg",
        "characters": [
            {
                "id": "char-ridiculous-man",
                "stable_key": "the-ridiculous-man",
                "name": "The Ridiculous Man",
                "role": "Philosopher & Preacher",
                "personality": (
                    "Introspective, metaphysical, and deeply transformed. Having confronted total nihilistic apathy, "
                    "his visionary voyage through space and eternity opened his eyes to divine love and the moral imperative "
                    "to love others as oneself."
                ),
                "appearance": "An unkempt Petersburg intellectual with piercing visionary eyes and a worn coat.",
                "avatar_asset_id": "portrait-the-ridiculous-man",
                "key_events": [
                    "Realized in childhood that everyone found him completely ridiculous",
                    "Bought a revolver intending to end his life on a gloomy November night",
                    "Pushed away a shivering eight-year-old girl crying for her dying mother",
                    "Felt overwhelming pity that proved conscience and human emotion still mattered",
                    "Dreamt of traveling through the cosmos to a pristine, unfallen Earth",
                    "Awakened with tears on his face, dedicating his remaining life to preaching the Truth",
                ],
                "relationships": [
                    "The Little Girl (The weeping child whose misery pierced his cold indifference)",
                    "The People of the Golden Age (The innocent beings of his cosmic dream)",
                ],
                "psi_parameters": {
                    "competence": 0.88,
                    "certainty": 0.92,
                    "valence": 0.80,
                    "voice": "echo",
                },
                "emotion_state": {
                    "enlightenment": 0.95,
                    "compassion": 0.90,
                    "melancholy": 0.20,
                },
            },
        ],
        "chapters": [
            (
                1,
                "Chapter 1: The Dark November Night and the Child",
                (
                    "I am a ridiculous person. They call me a madman now. That would be a promotion if it were not that "
                    "I remain as ridiculous to them as before. On a gloomy, rainy November evening, I made up my mind to shoot "
                    "myself. I had bought a revolver weeks earlier. Suddenly, a little girl caught my elbow. She was shivering, "
                    "soaked through, crying: 'Mammy! Mammy!' I stamped my foot and drove her away. But when I reached my room, "
                    "I could not pull the trigger. A terrible pity pierced my heart: if nothing mattered, why did I feel shame?"
                ),
            ),
            (
                2,
                "Chapter 2: The Cosmic Voyage",
                (
                    "Sitting in my armchair, the revolver resting on the table, sleep overcame me. In my dream, I shot myself "
                    "through the heart. A dark, mighty being took me by the hand and carried me through the black depths of space, "
                    "past constellations and galaxies, until we approached a brilliant sun illuminating an Earth just like ours, "
                    "yet radiant with unspoiled beauty. I landed upon an emerald shore where the air smelled of flowers and peace."
                ),
            ),
            (
                3,
                "Chapter 3: The Golden Age of Paradise",
                (
                    "The children of the sun gathered round me. Oh, how beautiful they were! They had never known sin, nor lie, "
                    "nor envy. Their eyes shone with clear light, and they greeted me with song and fraternal love. They lived in "
                    "communion with nature, trees, and stars. No science, no temples were needed, for they had a direct, living "
                    "knowledge of the universe. I loved them so much that my heart melted in worship."
                ),
            ),
            (
                4,
                "Chapter 4: The Fall and the Awakening",
                (
                    "Alas! Like a plague-spot infecting an entire state, I, a miserable wanderer from corrupted Earth, corrupted them all! "
                    "It began with a jest, a flirtation, a lie. Soon came shame, division, mine and thine, cruelty and war. "
                    "They built prisons and wrote laws. I wept, begging them to crucify me for bringing darkness to their Eden. "
                    "Then I woke up in my armchair. The candle was guttering out; the revolver lay untouched. I stood up and cried: "
                    "'I have seen the Truth! Love others as you love yourself — that is the whole law!'"
                ),
            ),
        ],
    },
    {
        "id": "book-dostoevsky-honest-thief",
        "title": "An Honest Thief",
        "author": "Fyodor Dostoevsky",
        "summary": (
            "A tender, heartbreaking story of forgiveness and conscience narrated by the elderly soldier Astafy Ivanovich. "
            "He takes in Emelyan Ilyitch, a helpless, broken drunkard. When a pair of riding breeches disappears, "
            "the quiet agony of shame and the dying man's final confession reveal the indestructible sanctity of the human soul."
        ),
        "cover_url": "/covers/an_honest_thief.svg",
        "characters": [
            {
                "id": "char-astafy-ivanovich",
                "stable_key": "astafy-ivanovich",
                "name": "Astafy Ivanovich",
                "role": "Narrator & Retired Soldier",
                "personality": (
                    "A disciplined, dignified, and deeply moral veteran. While he complains about thrift and sobriety, "
                    "his crusty exterior conceals a boundless Christian tenderness toward the broken and downtrodden."
                ),
                "appearance": "An elderly man with silver whiskers, a neat military posture, and weathered hands.",
                "avatar_asset_id": "portrait-astafy",
                "key_events": [
                    "Rents a quiet corner in St. Petersburg and works as a tailor",
                    "Takes in Emelyan Ilyitch after seeing him shivering and abandoned in a tavern",
                    "Stores his prized sky-blue riding breeches in his trunk",
                    "Confronts Emelyan with quiet grief when the breeches go missing",
                    "Stands vigil by Emelyan's deathbed, forgiving him wholeheartedly",
                ],
                "relationships": [
                    "Emelyan Ilyitch (The tragic stray soul who became his cross and companion)",
                    "The Landlord (The narrator to whom he recounts this tale)",
                ],
                "psi_parameters": {
                    "competence": 0.82,
                    "certainty": 0.88,
                    "valence": 0.70,
                    "voice": "fable",
                },
                "emotion_state": {
                    "compassion": 0.88,
                    "steadfastness": 0.90,
                    "grief": 0.35,
                },
            },
            {
                "id": "char-emelyan-ilyitch",
                "stable_key": "emelyan-ilyitch",
                "name": "Emelyan Ilyitch",
                "role": "The Tragic Companion",
                "personality": (
                    "Gentle, childlike, pathetic, and shattered by addiction. He has lost all worldly standing, yet his conscience "
                    "is so agonizingly alive that guilt tears his body and mind to pieces."
                ),
                "appearance": "A frail, trembling man in a threadbare coat with hollow cheeks and sorrowful dog-like eyes.",
                "avatar_asset_id": "portrait-emelyan",
                "key_events": [
                    "Followed Astafy Ivanovich through the Petersburg streets like a lost dog",
                    "Lived off Astafy's modest bread while drinking away every penny he could beg",
                    "Succumbed to temptation and stole the riding breeches to buy drink",
                    "Vanished into the freezing Petersburg snow for five days out of sheer shame",
                    "Returned starving and feverish, confessing with his last gasp before passing away",
                ],
                "relationships": [
                    "Astafy Ivanovich (His only protector, benefactor, and earthly judge)",
                ],
                "psi_parameters": {
                    "competence": 0.35,
                    "certainty": 0.30,
                    "valence": 0.45,
                    "voice": "shimmer",
                },
                "emotion_state": {
                    "repentance": 0.95,
                    "shame": 0.90,
                    "gratitude": 0.85,
                },
            },
        ],
        "chapters": [
            (
                1,
                "Chapter 1: The Stray Guest",
                (
                    "Astafy Ivanovich shook his head as he sat sewing a patch on a coat. 'It happened years ago,' he began. "
                    "'I took pity on Emelyushka. He was a creature utterly destroyed by drink — quiet, docile, never brawling. "
                    "He would sit in the corner of my room, gazing at me with eyes like an abandoned dog, grateful for a crust "
                    "of rye bread and a cup of warm tea. I would scold him: \"Emelyan, you are destroying yourself!\" and he would "
                    "merely sigh: \"Astafy Ivanovich, I know it, but the weakness is stronger than my soul.\"'"
                ),
            ),
            (
                2,
                "Chapter 2: The Sky-Blue Riding Breeches",
                (
                    "I had sewn a pair of sky-blue riding breeches for a gentleman, but they were left on my hands. "
                    "I kept them carefully folded in my trunk, hoping to sell them to an old-clothes dealer for five silver rubles. "
                    "One morning I opened the trunk, and they were gone! I looked at Emelyan. He was pale, staring at the floor, "
                    "his hands shaking. 'Emelyan,' I asked softly, 'did you take the riding breeches?' He turned red, then white: "
                    "'No, Astafy Ivanovich! As God is my witness, I never touched them!' But his eyes could not meet mine."
                ),
            ),
            (
                3,
                "Chapter 3: The Cold Snow and the Final Absolution",
                (
                    "Emelyan walked out into the biting wind and disappeared. Five days he wandered without food or shelter. "
                    "When he returned, his lips were blue, his cough tore at his chest. I put him in my own bed, warmed tea for him, "
                    "and never said a word about the breeches. On the sixth day, his breath grew faint. He pulled my sleeve: "
                    "'Astafy Ivanovich... take my old coat... sell it... It was I who took the riding breeches, Astafy. Forgive me...' "
                    "Tears flooded my eyes as I took his cold hand: 'God has forgiven you, Emelyan, and so have I.' "
                    "And with that, his gentle, tormented soul departed."
                ),
            ),
        ],
    },
]


def seed_dostoevsky_books(db: DatabaseManager, settings: Any) -> list[Book]:
    """
    Seeds the 3 Fyodor Dostoevsky short stories, characters, and vector embeddings idempotently.
    Returns the seeded or existing Book records.
    """
    embedder = EmbeddingService(settings)
    seeded_books: list[Book] = []

    with db.session_scope() as session:
        # Resolve primary admin user for library ownership
        admin_email = getattr(settings, "admin_email", "admin@lorely.app").strip().lower()
        admin_user = session.scalar(
            select(UserAccount).where(UserAccount.email == admin_email)
        )
        if admin_user is None:
            admin_user = UserAccount(
                supabase_user_id="admin-curator-user",
                email=admin_email,
                display_name="System Administrator",
            )
            session.add(admin_user)
            session.flush()

        role_rec = session.scalar(
            select(UserRole).where(UserRole.user_id == admin_user.id)
        )
        if role_rec is None:
            session.add(UserRole(user_id=admin_user.id, role="admin"))
        else:
            role_rec.role = "admin"
        session.flush()

        for book_info in DOSTOEVSKY_BOOKS_DATA:
            existing_book = session.scalar(
                select(Book).where(
                    Book.title == book_info["title"],
                    Book.author == book_info["author"],
                )
            )

            if existing_book is None:
                logger.info("Seeding featured Dostoevsky book: %s", book_info["title"])
                book = Book(
                    id=book_info["id"],
                    owner_user_id=admin_user.id,
                    title=book_info["title"],
                    author=book_info["author"],
                    summary=book_info["summary"],
                    cover_url=book_info["cover_url"],
                    visibility="featured",
                    source_type="book",
                    processing_status=BookProcessingStatus.ready,
                )
                session.add(book)
                session.flush()

                # Seed Characters
                for char_data in book_info["characters"]:
                    char = CharacterProfileRecord(
                        id=char_data["id"],
                        book_id=book.id,
                        stable_character_key=char_data["stable_key"],
                        name=char_data["name"],
                        role=char_data["role"],
                        personality=char_data["personality"],
                        appearance_description=char_data["appearance"],
                        avatar_asset_id=char_data["avatar_asset_id"],
                        key_events=char_data["key_events"],
                        relationships=char_data["relationships"],
                        psi_parameters=char_data["psi_parameters"],
                        emotion_state=char_data["emotion_state"],
                    )
                    session.add(char)

                # Seed Chunks & Embeddings
                for order, title, text_content in book_info["chapters"]:
                    vector = embedder.embed_text(text_content)
                    chunk = BookChunk(
                        book_id=book.id,
                        chapter_order=order,
                        chapter_title=title,
                        chunk_index=0,
                        content=text_content,
                        embedding=vector,
                    )
                    session.add(chunk)

                session.flush()
                seeded_books.append(book)
            else:
                seeded_books.append(existing_book)

    logger.info("Dostoevsky catalog seed complete. Total books: %d", len(seeded_books))
    return seeded_books


def purge_demo_and_test_data(db: DatabaseManager, settings: Any) -> dict[str, int]:
    """
    Purges demo and temporary test artifacts from the relational database,
    leaving the authentic Fyodor Dostoevsky literary catalog and legitimate accounts intact.
    """
    featured_ids = {b["id"] for b in DOSTOEVSKY_BOOKS_DATA}
    deleted_counts = {"books": 0, "messages": 0, "sessions": 0}

    with db.session_scope() as session:
        # 1. Identify all demo/test books
        demo_books = session.scalars(
            select(Book).where(Book.id.not_in(featured_ids))
        ).all()
        demo_book_ids = [b.id for b in demo_books]

        if demo_book_ids:
            # Find all demo characters
            demo_char_ids = session.scalars(
                select(CharacterProfileRecord.id).where(CharacterProfileRecord.book_id.in_(demo_book_ids))
            ).all()

            # Find all demo sessions
            demo_sessions = session.scalars(
                select(ChatSession).where(
                    (ChatSession.book_id.in_(demo_book_ids)) | (ChatSession.character_id.in_(demo_char_ids))
                )
            ).all()
            demo_session_ids = [s.id for s in demo_sessions]

            # Delete in strict dependency order:
            if demo_session_ids:
                msgs = session.query(ChatMessage).filter(ChatMessage.session_id.in_(demo_session_ids)).delete(synchronize_session=False)
                deleted_counts["messages"] += msgs
                session.query(CharacterMemory).filter(CharacterMemory.session_id.in_(demo_session_ids)).delete(synchronize_session=False)
                sess_cnt = session.query(ChatSession).filter(ChatSession.id.in_(demo_session_ids)).delete(synchronize_session=False)
                deleted_counts["sessions"] += sess_cnt

            if demo_char_ids:
                session.query(CharacterMemory).filter(CharacterMemory.character_id.in_(demo_char_ids)).delete(synchronize_session=False)
                session.query(UserCharacterState).filter(UserCharacterState.character_id.in_(demo_char_ids)).delete(synchronize_session=False)
                session.query(CharacterProfileRecord).filter(CharacterProfileRecord.id.in_(demo_char_ids)).delete(synchronize_session=False)

            session.query(BookChunk).filter(BookChunk.book_id.in_(demo_book_ids)).delete(synchronize_session=False)
            session.query(ProcessingJob).filter(ProcessingJob.book_id.in_(demo_book_ids)).delete(synchronize_session=False)
            session.query(BookSource).filter(BookSource.book_id.in_(demo_book_ids)).delete(synchronize_session=False)

            for b in demo_books:
                session.delete(b)
                deleted_counts["books"] += 1

        # 2. Also clean up any orphan sessions not tied to valid books, or unstarted 0-message sessions
        orphan_sessions = session.scalars(
            select(ChatSession).where(ChatSession.book_id.not_in(featured_ids))
        ).all()
        orphan_ids = [s.id for s in orphan_sessions]
        if orphan_ids:
            session.query(ChatMessage).filter(ChatMessage.session_id.in_(orphan_ids)).delete(synchronize_session=False)
            session.query(CharacterMemory).filter(CharacterMemory.session_id.in_(orphan_ids)).delete(synchronize_session=False)
            session.query(ChatSession).filter(ChatSession.id.in_(orphan_ids)).delete(synchronize_session=False)

        # Remove empty uninitiated sessions
        empty_sessions = session.scalars(
            select(ChatSession).where(~ChatSession.messages.any())
        ).all()
        for es in empty_sessions:
            session.delete(es)

        # 3. Ensure the designated Admin user exists
        admin_email = getattr(settings, "admin_email", "admin@lorely.app")
        admin_user = session.scalar(
            select(UserAccount).where(UserAccount.email == admin_email)
        )
        if admin_user is None:
            admin_user = UserAccount(
                supabase_user_id="admin-curator-user",
                email=admin_email,
                display_name="System Administrator",
            )
            session.add(admin_user)
            session.flush()

        role_rec = session.scalar(
            select(UserRole).where(UserRole.user_id == admin_user.id)
        )
        if role_rec is None:
            session.add(UserRole(user_id=admin_user.id, role="admin"))
        else:
            role_rec.role = "admin"

        session.flush()

    logger.info("Database cleanup completed: %s", deleted_counts)
    return deleted_counts


DEFAULT_MEMBERSHIP_PLANS = [
    {
        "id": "plan-free",
        "slug": "free",
        "name": "Free Reader",
        "category": "personal",
        "price_monthly": 0.0,
        "book_quota": "3",
        "daily_messages": "20",
        "voice_access": False,
        "description": "Exploration tier with access to standard classics and introductory character dialogues.",
        "features": [
            "Unlimited everyday text chats",
            "Access to standard classics",
            "Limited memory and storage",
            "Community support",
        ],
        "badge": "Your current plan",
        "sort_order": 1,
    },
    {
        "id": "plan-go",
        "slug": "go",
        "name": "Explorer (Go)",
        "category": "personal",
        "price_monthly": 5.0,
        "book_quota": "10",
        "daily_messages": "100",
        "voice_access": True,
        "description": "Expanded reading capacity, faster responses, and extended character conversational memory.",
        "features": [
            "10 personal shelf imports",
            "100 daily dialogue turns",
            "Expanded character memory",
            "Standard voice interactions",
            "Priority classification",
        ],
        "badge": None,
        "sort_order": 2,
    },
    {
        "id": "plan-scholar",
        "slug": "scholar",
        "name": "Literary Scholar (Plus)",
        "category": "personal",
        "price_monthly": 20.0,
        "book_quota": "unlimited",
        "daily_messages": "unlimited",
        "voice_access": True,
        "description": "Advanced cognitive simulations, unlimited shelf imports, HD speech synthesis, and full emotional telemetry.",
        "features": [
            "Unlimited book shelf imports",
            "Unlimited daily dialogue turns",
            "HD Voice mode simulation",
            "Dynamic emotional drift telemetry",
            "Spoiler-gated RAG indexing",
            "Character memory sync across devices",
        ],
        "badge": "✦ Most Popular",
        "sort_order": 3,
    },
    {
        "id": "plan-institution",
        "slug": "institution",
        "name": "Institutional Archive (Pro)",
        "category": "business",
        "price_monthly": 100.0,
        "book_quota": "unlimited",
        "daily_messages": "unlimited",
        "voice_access": True,
        "description": "Dedicated vector search namespace, multi-seat classroom access, and custom persona prompt fine-tuning.",
        "features": [
            "Isolated Chroma vector namespace",
            "Multi-seat classroom & research access",
            "Custom persona & directive fine-tuning",
            "LMS & export integration",
            "24/7 dedicated support & SLA",
        ],
        "badge": "Frontier Intelligence",
        "sort_order": 4,
    },
]


def seed_membership_plans(db: DatabaseManager) -> list[MembershipPlan]:
    """
    Seeds the default membership plans idempotently.
    Existing plans are preserved so admin edits are not overwritten.
    """
    seeded: list[MembershipPlan] = []
    with db.session_scope() as session:
        for pdata in DEFAULT_MEMBERSHIP_PLANS:
            existing = session.scalar(
                select(MembershipPlan).where(MembershipPlan.slug == pdata["slug"])
            )
            if existing is None:
                plan = MembershipPlan(
                    id=pdata["id"],
                    slug=pdata["slug"],
                    name=pdata["name"],
                    category=pdata["category"],
                    price_monthly=pdata["price_monthly"],
                    book_quota=pdata["book_quota"],
                    daily_messages=pdata["daily_messages"],
                    voice_access=pdata["voice_access"],
                    description=pdata["description"],
                    features=pdata["features"],
                    badge=pdata["badge"],
                    sort_order=pdata["sort_order"],
                    is_active=True,
                )
                session.add(plan)
                seeded.append(plan)
            else:
                seeded.append(existing)
        session.flush()
    logger.info("Membership plans seed complete. Total plans: %d", len(seeded))
    return seeded


DEFAULT_PAYMENT_CONFIG = {
    "telebirr_number": "0911234567",
    "telebirr_name": "Dawit (Lorely Admin)",
    "cbe_account_number": "100012345678",
    "cbe_account_name": "Dawit (Lorely Literary Simulation)",
    "etb_rate": 135.0,
    "telebirr_instructions": "Send transfer to the Telebirr number above and enter your transaction reference code.",
    "cbe_instructions": "Deposit or transfer to the CBE account number above and enter your FT reference code.",
}


def seed_payment_config(db: DatabaseManager) -> SystemSetting | None:
    """
    Seeds default Telebirr and CBE payment accounts into system_settings.
    """
    setting = None
    with db.session_scope() as session:
        setting = session.scalar(
            select(SystemSetting).where(SystemSetting.key == "payment_config")
        )
        if setting is None:
            setting = SystemSetting(
                key="payment_config",
                value=DEFAULT_PAYMENT_CONFIG,
                description="Payment accounts configuration including Telebirr and CBE details.",
            )
            session.add(setting)
            session.flush()
    logger.info("Payment config seed complete.")
    return setting



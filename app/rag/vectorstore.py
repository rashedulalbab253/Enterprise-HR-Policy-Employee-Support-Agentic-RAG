import time
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from app.core.config import get_settings

try:
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError:
    from langchain_community.embeddings import HuggingFaceEmbeddings

try:
    from langchain_openai import OpenAIEmbeddings
except ImportError:
    OpenAIEmbeddings = None

settings = get_settings()


_embeddings = None
_vectorstore = None


EMBEDDING_DIMENSIONS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "text-embedding-ada-002": 1536,
    "all-minilm-l6-v2": 384,
    "sentence-transformers/all-minilm-l6-v2": 384,
    "bge-small-en-v1.5": 384,
    "baai/bge-small-en-v1.5": 384,
    "bge-base-en-v1.5": 768,
    "baai/bge-base-en-v1.5": 768,
}


def get_embedding_dimension(model_name: str | None = None) -> int:
    name = (model_name or settings.embedding_model or "").strip()
    if not name:
        raise RuntimeError("Embedding model is not configured")
    normalized = name.lower()
    if normalized in EMBEDDING_DIMENSIONS:
        return EMBEDDING_DIMENSIONS[normalized]
    if "text-embedding-3-small" in normalized or "text-embedding-ada-002" in normalized:
        return 1536
    if "text-embedding-3-large" in normalized:
        return 3072
    if "minilm" in normalized or "bge-small" in normalized:
        return 384
    if "bge-base" in normalized or "text-embedding-004" in normalized:
        return 768
    raise ValueError(
        f"Unsupported embedding model '{model_name or settings.embedding_model}' for Pinecone. "
        "Add the matching dimension to EMBEDDING_DIMENSIONS."
    )



def resolve_hf_model_name(model_name: str) -> str:
    name = model_name.strip()
    if "/" in name:
        return name
    lowered = name.lower()
    if lowered.startswith("bge-"):
        return f"BAAI/{name}"
    if lowered.startswith("all-") or lowered.startswith("paraphrase-") or lowered.startswith("multi-qa-"):
        return f"sentence-transformers/{name}"
    return name


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        model_name = settings.embedding_model.strip()
        if model_name.startswith("text-embedding-"):
            if not settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY is missing for OpenAI embeddings")
            if OpenAIEmbeddings is None:
                raise RuntimeError("langchain-openai is required for OpenAI embeddings")
            _embeddings = OpenAIEmbeddings(
                model=model_name,
                api_key=settings.openai_api_key,
            )
        else:
            # Local HuggingFace Embeddings (Free, runs locally on CPU)
            hf_model = resolve_hf_model_name(model_name)
            _embeddings = HuggingFaceEmbeddings(
                model_name=hf_model,
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True},
            )
    return _embeddings



def ensure_index():
    if not settings.pinecone_api_key:
        raise RuntimeError("PINECONE_API_KEY is missing")
    desired_dimension = get_embedding_dimension()
    pc = Pinecone(api_key=settings.pinecone_api_key)
    names = [x["name"] for x in pc.list_indexes()]

    if settings.pinecone_index_name in names:
        index_info = pc.describe_index(settings.pinecone_index_name)
        current_dimension = getattr(index_info, "dimension", None)
        if current_dimension is None and isinstance(index_info, dict):
            current_dimension = index_info.get("dimension")
        if current_dimension is not None and current_dimension != desired_dimension:
            pc.delete_index(name=settings.pinecone_index_name)
            while settings.pinecone_index_name in [x["name"] for x in pc.list_indexes()]:
                time.sleep(1)
    if settings.pinecone_index_name not in [x["name"] for x in pc.list_indexes()]:
        pc.create_index(
            name=settings.pinecone_index_name,
            dimension=desired_dimension,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        while not pc.describe_index(settings.pinecone_index_name).status["ready"]:
            time.sleep(1)

    return pc.Index(settings.pinecone_index_name)



def get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        index = ensure_index()
        _vectorstore = PineconeVectorStore(
            index=index,
            embedding=get_embeddings(),
            namespace=settings.pinecone_namespace,
        )
    return _vectorstore



def get_retriever():
    return get_vectorstore().as_retriever(search_kwargs={"k": settings.top_k})




def add_documents(chunks):
    store = get_vectorstore()
    return store.add_documents(chunks)

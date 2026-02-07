from fastapi import FastAPI

from .routers import note, provider, model, config, rag





def create_app(lifespan) -> FastAPI:

    app = FastAPI(title="BiliNote", lifespan=lifespan)

    app.include_router(note.router, prefix="/api")
    app.include_router(provider.router, prefix="/api")
    app.include_router(model.router, prefix="/api")
    app.include_router(config.router, prefix="/api")
    app.include_router(rag.router, prefix="/api/rag")

    # Add system health check endpoints at root level for frontend compatibility
    from .routers.config import sys_health, sys_check
    app.add_api_route("/sys_health", sys_health, methods=["GET"], tags=["system"])
    app.add_api_route("/sys_check", sys_check, methods=["GET"], tags=["system"])
    
    # Add image_proxy at root level for frontend compatibility
    from .routers.note import image_proxy
    app.add_api_route("/image_proxy", image_proxy, methods=["GET"], tags=["proxy"])

    return app



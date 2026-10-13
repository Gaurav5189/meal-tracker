from pydantic import BaseModel


class MeOut(BaseModel):
    username: str
    name: str
    tz: str

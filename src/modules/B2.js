const Box2D = require("box2dweb");

module.exports = {
    b2Vec2: Box2D.Common.Math.b2Vec2,
    b2BodyDef: Box2D.Dynamics.b2BodyDef,
    b2AABB: Box2D.Collision.b2AABB,
    b2Body: Box2D.Dynamics.b2Body,
    b2FixtureDef: Box2D.Dynamics.b2FixtureDef,
    b2Fixture: Box2D.Dynamics.b2Fixture,
    b2World: Box2D.Dynamics.b2World,
    b2MassData: Box2D.Collision.Shapes.b2MassData,
    b2PolygonShape: Box2D.Collision.Shapes.b2PolygonShape,
    b2CircleShape: Box2D.Collision.Shapes.b2CircleShape,
    b2DebugDraw: Box2D.Dynamics.b2DebugDraw,
    b2MouseJointDef: Box2D.Dynamics.Joints.b2MouseJointDef,
    b2EdgeShape: Box2D.Collision.Shapes.b2EdgeShape,
    b2ContactListener: Box2D.Dynamics.b2ContactListener,
    b2Contact: Box2D.Dynamics.Contacts.b2Contact,
    b2FilterData: Box2D.Dynamics.b2FilterData
};

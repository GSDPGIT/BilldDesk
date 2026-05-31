// Agents 表 —— 被控端注册信息
import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';

import sequelize from '@/config/mysql';
import { initTable } from '@/init/initDb';
import { IAgent } from '@/types/IAgent';

interface AgentModel
  extends Model<
      InferAttributes<AgentModel>,
      InferCreationAttributes<AgentModel>
    >,
    IAgent {}

const model = sequelize.define<AgentModel>(
  'agent',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true,
    },
    device_id: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
      comment: '设备唯一标识（硬件指纹/UUID）',
    },
    hostname: {
      type: DataTypes.STRING(255),
      comment: '计算机名',
    },
    platform: {
      type: DataTypes.STRING(32),
      comment: 'win32 / darwin / linux',
    },
    os_version: {
      type: DataTypes.STRING(128),
    },
    public_ip: {
      type: DataTypes.STRING(64),
      comment: '服务端从 ctx.ip 自动获取',
    },
    local_ip: {
      type: DataTypes.STRING(64),
    },
    agent_version: {
      type: DataTypes.STRING(32),
    },
    registered_at: {
      type: DataTypes.DATE,
    },
    last_heartbeat: {
      type: DataTypes.DATE,
      comment: '上次心跳时间，用于判断 is_online',
    },
    custom_config: {
      type: DataTypes.JSON,
      comment:
        '主控端可远程推送的配置，如 lockOnDisconnect / privacyMode 等',
    },
    nickname: {
      type: DataTypes.STRING(128),
      comment: '用户自定义昵称',
    },
    socket_id: {
      type: DataTypes.STRING(128),
      comment: '当前 socket.io 连接 ID',
    },
  },
  {
    paranoid: true,
    freezeTableName: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }
);

initTable({ model, sequelize });

export default model;

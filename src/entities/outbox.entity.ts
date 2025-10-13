import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum OutboxStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED'
}

@Entity('outbox')
export class OutboxEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  destination: string;

  @Column()
  pattern: string;

  @Column({type:'jsonb'})
  payload: Record<string, any>;

  @Column({type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING})
  status: OutboxStatus;

  @CreateDateColumn()
  created_at: Date;
}